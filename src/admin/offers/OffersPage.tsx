import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  ShieldCheck,
  Percent,
  CheckCircle2,
  Gift,
  AlertCircle,
  Copy,
  Info,
  Plus,
  Edit2,
  Trash2,
  Power,
  RefreshCw,
  X,
  Calendar,
  Clock,
  IndianRupee,
  Users,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { Promotion, DiscountType, PromotionType, PromotionStatus } from '../../types';

interface OffersPageProps {
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

interface OfferFormData {
  id?: string;
  name: string;
  code: string;
  type: PromotionType;
  discountType: DiscountType;
  discountValueDisplay: string; // Percent (e.g. "20") or Rupees (e.g. "50")
  active: boolean;
  startsAt: string;
  expiresAt: string;
  minimumOrderRupees: string;
  maximumDiscountRupees: string;
  usageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  applicableProductIds: string[];
  description: string;
}

const initialFormData: OfferFormData = {
  name: '',
  code: '',
  type: 'COUPON',
  discountType: 'PERCENTAGE',
  discountValueDisplay: '20',
  active: true,
  startsAt: '',
  expiresAt: '',
  minimumOrderRupees: '',
  maximumDiscountRupees: '',
  usageLimit: '',
  perCustomerLimit: '1',
  firstOrderOnly: false,
  applicableProductIds: [],
  description: '',
};

export const OffersPage: React.FC<OffersPageProps> = ({ showToast }) => {
  const { books } = useShop();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<OfferFormData>(initialFormData);
  const [isEditing, setIsEditing] = useState(false);

  const fetchPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/offers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const list = (data && (data.promotions || data.offers)) || [];
        if (Array.isArray(list)) {
          setPromotions(list);
        }
      } else {
        showToast('Could not load promotions from server.', 'warning');
      }
    } catch {
      showToast('Network error while fetching promotions.', 'warning');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`Coupon code "${code}" copied to clipboard!`, 'success');
  };

  const handleOpenCreateModal = () => {
    setFormData(initialFormData);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (promo: Promotion) => {
    // Format discount value display
    const discountVal =
      promo.discountType === 'PERCENTAGE'
        ? String(promo.discountValue)
        : String(Math.round(promo.discountValue / 100));

    // Convert ISO to datetime-local input string (YYYY-MM-DDTHH:mm)
    const formatDateTime = (iso?: string | null) => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
      } catch {
        return '';
      }
    };

    setFormData({
      id: promo.id,
      name: promo.name || '',
      code: promo.code || '',
      type: promo.type || 'COUPON',
      discountType: promo.discountType || 'PERCENTAGE',
      discountValueDisplay: discountVal,
      active: promo.active ?? true,
      startsAt: formatDateTime(promo.startsAt),
      expiresAt: formatDateTime(promo.expiresAt),
      minimumOrderRupees: promo.minimumOrderPaise ? String(Math.round(promo.minimumOrderPaise / 100)) : '',
      maximumDiscountRupees: promo.maximumDiscountPaise ? String(Math.round(promo.maximumDiscountPaise / 100)) : '',
      usageLimit: promo.usageLimit ? String(promo.usageLimit) : '',
      perCustomerLimit: promo.perCustomerLimit ? String(promo.perCustomerLimit) : '1',
      firstOrderOnly: Boolean(promo.firstOrderOnly),
      applicableProductIds: Array.isArray(promo.applicableProductIds) ? promo.applicableProductIds : [],
      description: promo.description || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      const nextActive = !promo.active;
      const res = await fetch('/api/admin/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: promo.id,
          active: nextActive,
        }),
      });

      if (res.ok) {
        showToast(
          `Offer "${promo.code}" ${nextActive ? 'enabled' : 'disabled'} successfully.`,
          'success'
        );
        fetchPromotions();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update offer status.', 'warning');
      }
    } catch {
      showToast('Error updating offer.', 'warning');
    }
  };

  const handleDeleteOffer = async (promo: Promotion) => {
    if (!confirm(`Are you sure you want to delete offer "${promo.code}"?`)) return;

    try {
      const res = await fetch('/api/admin/offers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: promo.id }),
      });

      if (res.ok) {
        showToast(`Offer "${promo.code}" deleted.`, 'success');
        fetchPromotions();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete offer.', 'warning');
      }
    } catch {
      showToast('Error deleting offer.', 'warning');
    }
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      showToast('Please enter a promotion code.', 'warning');
      return;
    }
    const cleanName = formData.name.trim();
    if (!cleanName) {
      showToast('Please enter an offer name.', 'warning');
      return;
    }

    const numVal = parseFloat(formData.discountValueDisplay);
    if (isNaN(numVal) || numVal <= 0) {
      showToast('Discount value must be greater than 0.', 'warning');
      return;
    }

    if (formData.discountType === 'PERCENTAGE' && numVal > 100) {
      showToast('Percentage discount cannot exceed 100%.', 'warning');
      return;
    }

    // Convert display to server integer paise if fixed amount
    const discountValue =
      formData.discountType === 'PERCENTAGE'
        ? Math.round(numVal)
        : Math.round(numVal * 100);

    const minPaise = formData.minimumOrderRupees ? Math.round(parseFloat(formData.minimumOrderRupees) * 100) : null;
    const maxPaise = formData.maximumDiscountRupees ? Math.round(parseFloat(formData.maximumDiscountRupees) * 100) : null;
    const uLimit = formData.usageLimit ? parseInt(formData.usageLimit, 10) : null;
    const cLimit = formData.perCustomerLimit ? parseInt(formData.perCustomerLimit, 10) : 1;

    const payload = {
      ...(isEditing && formData.id ? { id: formData.id } : {}),
      code: cleanCode,
      name: cleanName,
      type: formData.type,
      discountType: formData.discountType,
      discountValue,
      active: formData.active,
      startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      minimumOrderPaise: minPaise && minPaise > 0 ? minPaise : null,
      maximumDiscountPaise: maxPaise && maxPaise > 0 ? maxPaise : null,
      usageLimit: uLimit && uLimit > 0 ? uLimit : null,
      perCustomerLimit: cLimit && cLimit > 0 ? cLimit : 1,
      firstOrderOnly: formData.firstOrderOnly,
      applicableProductIds: formData.applicableProductIds.length > 0 ? formData.applicableProductIds : null,
      description: formData.description.trim(),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/offers', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(
          `Offer "${cleanCode}" ${isEditing ? 'updated' : 'created'} successfully!`,
          'success'
        );
        setIsModalOpen(false);
        fetchPromotions();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save offer.', 'warning');
      }
    } catch {
      showToast('Network error while saving offer.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductApplicability = (productId: string) => {
    setFormData((prev) => {
      const current = prev.applicableProductIds;
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      return { ...prev, applicableProductIds: next };
    });
  };

  const getStatusBadge = (status?: PromotionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ACTIVE
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-indigo-600" />
            SCHEDULED
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
            <Calendar className="w-3 h-3 text-amber-600" />
            EXPIRED
          </span>
        );
      case 'EXHAUSTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            EXHAUSTED
          </span>
        );
      case 'DISABLED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            <Power className="w-3 h-3 text-slate-400" />
            DISABLED
          </span>
        );
    }
  };

  const activeCount = promotions.filter((p) => p.status === 'ACTIVE').length;
  const totalUses = promotions.reduce((sum, p) => sum + (p.timesUsed || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            Promotions, Coupons & Bundles
          </h2>
          <p className="text-xs text-slate-500">
            Server-authoritative promotional pricing, coupon redemption limits & bundle rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPromotions}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Refresh Promotions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Offer</span>
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-3xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wide">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Server-Authoritative Pricing Architecture (Phase 10 Hardened)</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
          The browser is never authoritative for discounts. Every coupon, minimum order value, usage limit, and
          product targeting rule is calculated and verified directly inside Cloudflare Pages Functions (<code>functions/utils/pricing.js</code>)
          before the final amount is registered with Cashfree.
        </p>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Total Promotions</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{promotions.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Currently Active</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Total Redemptions</div>
          <div className="text-xl font-bold text-indigo-600 mt-1">{totalUses}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Active Bundles</div>
          <div className="text-xl font-bold text-purple-600 mt-1">1 Deal</div>
        </div>
      </div>

      {/* Promotions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Verified Server Promotion Codes
          </h3>
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
            {promotions.length} Configured
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-xs">Loading promotion catalog...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
            <Tag className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">No promotions created yet.</p>
            <p className="text-xs text-slate-400">Click "Create Offer" above to configure your first coupon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions.map((promo) => {
              const remainingUses =
                promo.usageLimit !== null && promo.usageLimit !== undefined
                  ? Math.max(0, promo.usageLimit - (promo.timesUsed || 0))
                  : null;

              return (
                <div
                  key={promo.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl font-mono tracking-wider">
                          {promo.code}
                        </span>
                        <button
                          onClick={() => copyCoupon(promo.code)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Copy Code"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(promo.status)}
                        <button
                          onClick={() => handleToggleActive(promo)}
                          className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            promo.active
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                          title={promo.active ? 'Disable offer' : 'Enable offer'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Name & Description */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{promo.name}</h4>
                      {promo.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{promo.description}</p>
                      )}
                    </div>

                    {/* Rule Pill Matrix */}
                    <div className="p-2.5 bg-slate-50 rounded-xl space-y-1.5 font-mono text-[11px] text-slate-700 border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-sans">Discount:</span>
                        <strong className="text-slate-900">
                          {promo.discountType === 'PERCENTAGE'
                            ? `${promo.discountValue}% OFF`
                            : `₹${Math.round(promo.discountValue / 100)} FLAT`}
                        </strong>
                      </div>

                      {promo.minimumOrderPaise && promo.minimumOrderPaise > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-sans">Min Order:</span>
                          <span className="text-slate-700">₹{Math.round(promo.minimumOrderPaise / 100)}</span>
                        </div>
                      )}

                      {promo.maximumDiscountPaise && promo.maximumDiscountPaise > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-sans">Max Discount:</span>
                          <span className="text-slate-700">₹{Math.round(promo.maximumDiscountPaise / 100)}</span>
                        </div>
                      )}

                      {promo.perCustomerLimit && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-sans">Per Customer:</span>
                          <span className="text-slate-700">{promo.perCustomerLimit} use(s)</span>
                        </div>
                      )}

                      {promo.firstOrderOnly && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-sans">Eligibility:</span>
                          <span className="text-amber-700 font-semibold font-sans text-[10px]">First Order Only</span>
                        </div>
                      )}

                      {Array.isArray(promo.applicableProductIds) && promo.applicableProductIds.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-sans">Targets:</span>
                          <span className="text-emerald-700 font-sans text-[10px] font-semibold">
                            {promo.applicableProductIds.length} Product(s)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Redemptions Reporting Row */}
                    <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3 h-3 text-slate-400" />
                        Uses: <strong>{promo.timesUsed || 0}</strong>
                        {promo.usageLimit !== null && promo.usageLimit !== undefined && (
                          <span className="text-slate-400">/ {promo.usageLimit} limit</span>
                        )}
                      </span>

                      {remainingUses !== null && (
                        <span className={`text-[10px] font-bold ${remainingUses === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {remainingUses} left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100">
                    <span className="text-emerald-700 font-bold">Cloudflare Verified</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(promo)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-semibold p-1 hover:bg-slate-100 rounded-md cursor-pointer flex items-center gap-1"
                        title="Edit Offer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(promo)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold p-1 hover:bg-rose-50 rounded-md cursor-pointer flex items-center gap-1"
                        title="Delete Offer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalog Bundle Deals Callout */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Active Catalog Bundle Deals: "Buy 2 Get 3rd Add-on FREE" & Complete Bundles
          </h3>
        </div>

        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
          The application supports server-authoritative bundle deals:
          <br />
          1. <strong>Add-on Bundle Deal:</strong> When a learner adds 2 or more add-on items (Speaking Cue Cards, Writing Templates, etc.) to their cart,
          the lowest-priced add-on is automatically 100% discounted server-side.
          <br />
          2. <strong>Complete Product Bundles:</strong> Products configured with <code>isBundle: true</code> and <code>bundledProductIds</code> grant separate entitlements for every individual bundled guide upon verified payment.
        </p>

        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-3">
          <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <p>
            Bundle pricing and fulfillment are strictly authoritative in <code>functions/utils/pricing.js</code> and <code>functions/utils/db.js</code>.
          </p>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  {isEditing ? 'Edit Promotion Offer' : 'Create New Promotion'}
                </h3>
                <p className="text-xs text-slate-500">Configure promotional rules & discount limits</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveOffer} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Offer Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. XYLEM20"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Offer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. New Student 20% Off"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Discount Type
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Discount Value {formData.discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.discountType === 'PERCENTAGE' ? '100' : '100000'}
                    value={formData.discountValueDisplay}
                    onChange={(e) => setFormData({ ...formData, discountValueDisplay: e.target.value })}
                    placeholder={formData.discountType === 'PERCENTAGE' ? '20' : '50'}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Starts & Expires */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Starts At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Expires At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Minimum Order & Maximum Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Minimum Order (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minimumOrderRupees}
                    onChange={(e) => setFormData({ ...formData, minimumOrderRupees: e.target.value })}
                    placeholder="e.g. 299"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Maximum Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maximumDiscountRupees}
                    onChange={(e) => setFormData({ ...formData, maximumDiscountRupees: e.target.value })}
                    placeholder="e.g. 100 (for %)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Usage Limit & Per-Customer Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Global Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    placeholder="e.g. 100 (unlimited if empty)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Per-Customer Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.perCustomerLimit}
                    onChange={(e) => setFormData({ ...formData, perCustomerLimit: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* First Order Only & Active Checkboxes */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.firstOrderOnly}
                    onChange={(e) => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>First-Order Only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Active Status</span>
                </label>
              </div>

              {/* Applicable Products Targeting */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700 uppercase tracking-wider">
                  Applies To Specific Products (Leave empty for all products)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {books.map((b) => {
                    const isSelected = formData.applicableProductIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-[11px] transition-colors ${
                          isSelected ? 'bg-emerald-100/70 text-emerald-950 font-bold' : 'hover:bg-slate-200/50 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProductApplicability(b.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate">{b.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Promotional offer for IELTS candidates"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isEditing ? 'Update Offer' : 'Save Offer'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
