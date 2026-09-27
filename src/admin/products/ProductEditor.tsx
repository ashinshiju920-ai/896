import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Trash2,
  FileText,
  Eye,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Layers,
  Star,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { Book, ExamCategory, ProductAddon } from '../../types';
import { uploadImageToCloud } from '../../utils/cloudSync';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ProductEditorProps {
  initialBook?: Book | null;
  onSave: (bookData: Omit<Book, 'id'>, id?: string) => void;
  onCancel: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  openPdfViewer?: (book: Book) => void;
}

export const ProductEditor: React.FC<ProductEditorProps> = ({
  initialBook,
  onSave,
  onCancel,
  showToast,
  openPdfViewer,
}) => {
  const isEditing = Boolean(initialBook);

  const defaultFormData: Omit<Book, 'id'> = {
    title: initialBook?.title || '',
    subtitle: initialBook?.subtitle || '',
    category: initialBook?.category || 'IELTS',
    type: initialBook?.type || 'Study Guides',
    isBestSeller: initialBook?.isBestSeller || false,
    isNew: initialBook?.isNew ?? true,
    rating: initialBook?.rating || 4.8,
    reviewCount: initialBook?.reviewCount || 1,
    buyersCount: initialBook?.buyersCount || 0,
    description: initialBook?.description || '',
    longDescription: initialBook?.longDescription || '',
    features: initialBook?.features || [
      'Complete Exam Syllabus 2026',
      'Step-by-Step Solved Questions',
      'High-Scoring Vocabulary & Examiner Rubrics',
    ],
    whatYouGet: initialBook?.whatYouGet || [
      'Full PDF eBook with printable study worksheets',
      'Comprehensive audio scripts & answer keys',
      'Lifetime digital access & updates',
    ],
    tableOfContents: initialBook?.tableOfContents || [
      { chapter: 'Module 1: Diagnostic Strategy & Scoring Criteria', pages: 'pp. 1-28' },
      { chapter: 'Module 2: Core Subject Fundamentals', pages: 'pp. 29-94' },
      { chapter: 'Module 3: Practice Drills with Band 8+ Templates', pages: 'pp. 95-180' },
      { chapter: 'Module 4: 10 Full-Length Timed Mock Tests', pages: 'pp. 181-280' },
    ],
    prices: {
      digital: {
        price: initialBook?.prices?.digital?.price ?? 199,
        originalPrice: initialBook?.prices?.digital?.originalPrice ?? 599,
        discountPercent: initialBook?.prices?.digital?.discountPercent ?? 67,
      },
      physical: {
        price: initialBook?.prices?.physical?.price ?? 999,
        originalPrice: initialBook?.prices?.physical?.originalPrice ?? 1299,
        discountPercent: initialBook?.prices?.physical?.discountPercent ?? 23,
      },
    },
    coverTheme: initialBook?.coverTheme || {
      bgGradient: 'from-[#0b2239] via-[#0f2e4f] to-[#081829]',
      accentColor: '#00875a',
      textColor: '#ffffff',
      badgeText: '2026 EXAM EDITION',
    },
    samplePdfName: initialBook?.samplePdfName || 'Xylem_Official_Prep_Guide.pdf',
    pdfUrl: initialBook?.pdfUrl || '',
    imageUrl: initialBook?.imageUrl || '',
    coverImage: initialBook?.coverImage || '',
    images: initialBook?.images || [],
    adLink: initialBook?.adLink || '',
    adText: initialBook?.adText || '',
    totalPages: initialBook?.totalPages || 280,
    reviews: initialBook?.reviews || [],
    addons: initialBook?.addons && initialBook.addons.length > 0
      ? initialBook.addons.map((a) => ({
          ...a,
          id: a.id === 'addon_digital' ? 'digital' : (a.id === 'addon_physical' ? 'physical' : a.id),
        }))
      : [
          {
            id: 'digital',
            name: 'Digital (PDF)',
            subtitle: 'Instant Download',
            price: initialBook?.prices?.digital?.price ?? 499,
            originalPrice: initialBook?.prices?.digital?.originalPrice ?? 999,
            deliveryOption: 'digital',
          },
          {
            id: 'physical',
            name: 'Physical (Printed)',
            subtitle: 'Delivered in 3-5 days',
            price: initialBook?.prices?.physical?.price ?? 899,
            originalPrice: initialBook?.prices?.physical?.originalPrice ?? 1499,
            deliveryOption: 'physical',
          },
        ],
    buy2Get3rdFree: Boolean(initialBook?.buy2Get3rdFree),
    addonDealText: initialBook?.addonDealText || 'Special Deal: Buy Any 2 Add-ons, Get the 3rd FREE!',
  };

  const [form, setForm] = useState<Omit<Book, 'id'>>(defaultFormData);
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'media' | 'digital' | 'curriculum' | 'addons' | 'display'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Feature & WhatYouGet temp inputs
  const [featureInput, setFeatureInput] = useState('');
  const [whatYouGetInput, setWhatYouGetInput] = useState('');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof Omit<Book, 'id'>>(key: K, val: Omit<Book, 'id'>[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  // Image Upload handler
  const handleUploadImage = async (file: File, slotIndex?: number) => {
    setIsUploading(true);
    setUploadSlot(slotIndex ?? 0);
    try {
      const imageUrl = await uploadImageToCloud(file, initialBook?.id || 'new-product');
      const currentImages = form.images && form.images.length > 0 ? [...form.images] : (form.imageUrl ? [form.imageUrl] : []);

      if (slotIndex !== undefined && slotIndex >= 0) {
        currentImages[slotIndex] = imageUrl;
      } else {
        currentImages[0] = imageUrl;
      }

      const nextImages = currentImages.filter(Boolean).slice(0, 4);
      setForm((prev) => ({
        ...prev,
        images: nextImages,
        imageUrl: slotIndex === 0 || !prev.imageUrl ? imageUrl : prev.imageUrl,
        coverImage: slotIndex === 0 || !prev.coverImage ? imageUrl : prev.coverImage,
      }));
      setIsDirty(true);
      showToast('Image uploaded successfully to Cloudinary!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'warning');
    } finally {
      setIsUploading(false);
      setUploadSlot(null);
    }
  };

  // PDF File Upload handler (Base64)
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('File exceeds 25 MB limit for direct PDF attachment', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setForm((prev) => ({
        ...prev,
        pdfUrl: base64,
        samplePdfName: file.name,
      }));
      setIsDirty(true);
      showToast(`PDF "${file.name}" attached successfully!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Please enter a product title', 'warning');
      setActiveTab('general');
      return;
    }

    setIsSaving(true);
    try {
      onSave(form, initialBook?.id);
      setIsDirty(false);
      showToast(isEditing ? 'Product updated successfully!' : 'New product published to catalog!', 'success');
    } catch (err) {
      showToast('Failed to save product', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelModal(true);
    } else {
      onCancel();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              {isEditing ? `Edit: ${initialBook?.title}` : 'Add New Study Guide'}
            </h2>
            <p className="text-xs text-slate-500">
              {isEditing ? `SKU: ${initialBook?.id}` : 'Fill in product information to create a new live catalog item'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#00875a] hover:bg-[#00734c] disabled:opacity-50 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isEditing ? 'Save Changes' : 'Publish Product'}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'general', label: '1. General Info' },
          { id: 'pricing', label: '2. Pricing' },
          { id: 'media', label: '3. Media & Images' },
          { id: 'digital', label: '4. Digital Asset (PDF)' },
          { id: 'curriculum', label: '5. Curriculum & TOC' },
          { id: 'addons', label: '6. Add-ons & Deals' },
          { id: 'display', label: '7. Marketing & Flags' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
        {/* TAB 1: GENERAL INFO */}
        {activeTab === 'general' && (
          <div className="space-y-5 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. IELTS Academic Full Preparation with 10 Mock Tests"
                  required
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Subtitle / Tagline
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => updateField('subtitle', e.target.value)}
                  placeholder="e.g. Complete Study Guide for Academic & General Training Candidates"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Exam Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value as ExamCategory)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold"
                >
                  <option value="IELTS">IELTS</option>
                  <option value="OET">OET</option>
                  <option value="PTE">PTE</option>
                  <option value="German">German</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Guide Type *
                </label>
                <select
                  value={form.type}
                  onChange={(e) => updateField('type', e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold"
                >
                  <option value="Study Guides">Study Guides</option>
                  <option value="Practice Books">Practice Books</option>
                  <option value="Mock Tests">Mock Tests</option>
                  <option value="Vocabulary & Grammar">Vocabulary & Grammar</option>
                  <option value="Bundle Packs">Bundle Packs</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Summary shown on product cards and catalog previews..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Full Detailed Description
                </label>
                <textarea
                  rows={4}
                  value={form.longDescription}
                  onChange={(e) => updateField('longDescription', e.target.value)}
                  placeholder="Comprehensive description displayed on the product detail page..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRICING */}
        {activeTab === 'pricing' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              <strong className="block font-bold">Authoritative Pricing Note:</strong>
              These prices are authoritative and synced directly to Cloudflare KV. Customer orders re-validate against this catalog server-side.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Digital Price Card */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Digital Edition (PDF)
                  </h4>
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    Instant Download
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Selling Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.prices?.digital?.price}
                      onChange={(e) => {
                        const price = Math.max(0, parseInt(e.target.value) || 0);
                        const orig = form.prices?.digital?.originalPrice || price;
                        const discount = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;
                        setForm((prev) => {
                          const updatedAddons = (prev.addons || []).map((a) =>
                            a.id === 'digital' || a.deliveryOption === 'digital'
                              ? { ...a, price, originalPrice: orig }
                              : a
                          );
                          return {
                            ...prev,
                            prices: {
                              ...prev.prices,
                              digital: { price, originalPrice: orig, discountPercent: discount },
                            },
                            addons: updatedAddons,
                          };
                        });
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Original Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.prices?.digital?.originalPrice}
                      onChange={(e) => {
                        const orig = Math.max(0, parseInt(e.target.value) || 0);
                        const price = form.prices?.digital?.price || 0;
                        const discount = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;
                        setForm((prev) => {
                          const updatedAddons = (prev.addons || []).map((a) =>
                            a.id === 'digital' || a.deliveryOption === 'digital'
                              ? { ...a, originalPrice: orig }
                              : a
                          );
                          return {
                            ...prev,
                            prices: {
                              ...prev.prices,
                              digital: { price, originalPrice: orig, discountPercent: discount },
                            },
                            addons: updatedAddons,
                          };
                        });
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Price Card */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Physical Printed Edition
                  </h4>
                  <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    Courier Dispatch
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Selling Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.prices?.physical?.price}
                      onChange={(e) => {
                        const price = Math.max(0, parseInt(e.target.value) || 0);
                        const orig = form.prices?.physical?.originalPrice || price;
                        const discount = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;
                        setForm((prev) => {
                          const updatedAddons = (prev.addons || []).map((a) =>
                            a.id === 'physical' || a.deliveryOption === 'physical'
                              ? { ...a, price, originalPrice: orig }
                              : a
                          );
                          return {
                            ...prev,
                            prices: {
                              ...prev.prices,
                              physical: { price, originalPrice: orig, discountPercent: discount },
                            },
                            addons: updatedAddons,
                          };
                        });
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Original Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.prices?.physical?.originalPrice}
                      onChange={(e) => {
                        const orig = Math.max(0, parseInt(e.target.value) || 0);
                        const price = form.prices?.physical?.price || 0;
                        const discount = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;
                        setForm((prev) => {
                          const updatedAddons = (prev.addons || []).map((a) =>
                            a.id === 'physical' || a.deliveryOption === 'physical'
                              ? { ...a, originalPrice: orig }
                              : a
                          );
                          return {
                            ...prev,
                            prices: {
                              ...prev.prices,
                              physical: { price, originalPrice: orig, discountPercent: discount },
                            },
                            addons: updatedAddons,
                          };
                        });
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MEDIA & IMAGES */}
        {activeTab === 'media' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Cloudinary Image Gallery (Slots 1 to 4)
              </label>
              <p className="text-xs text-slate-500">
                Upload genuine images (JPEG, PNG, WebP up to 5 MB) directly to Cloudinary via server edge.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const currentSlotImg = form.images?.[slotIdx] || (slotIdx === 0 ? form.imageUrl : '');
                  const isUploadingThis = isUploading && uploadSlot === slotIdx;

                  return (
                    <div
                      key={slotIdx}
                      className="border border-slate-200 rounded-2xl p-3 bg-slate-50 flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">Slot {slotIdx + 1}</span>
                        {slotIdx === 0 && (
                          <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            Cover
                          </span>
                        )}
                      </div>

                      {/* Image Preview Canvas */}
                      <div className="w-full h-36 bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center relative">
                        {currentSlotImg ? (
                          <img
                            src={currentSlotImg}
                            alt={`Slot ${slotIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-3 text-slate-400 text-[11px]">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                            <span>Empty Slot</span>
                          </div>
                        )}

                        {isUploadingThis && (
                          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-xs font-bold">
                            <Loader2 className="w-5 h-5 animate-spin mr-1" />
                            <span>Uploading...</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-1.5">
                        <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors">
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>{currentSlotImg ? 'Replace' : 'Upload'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadImage(f, slotIdx);
                            }}
                            className="hidden"
                          />
                        </label>

                        {currentSlotImg && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(form.images || [])];
                              next.splice(slotIdx, 1);
                              setForm((prev) => ({
                                ...prev,
                                images: next,
                                imageUrl: slotIdx === 0 ? next[0] || '' : prev.imageUrl,
                              }));
                              setIsDirty(true);
                            }}
                            className="w-full py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct Image URL input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Or Direct Image URL (Primary Cover)
              </label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => {
                  updateField('imageUrl', e.target.value);
                  updateField('coverImage', e.target.value);
                }}
                placeholder="https://res.cloudinary.com/..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
        )}

        {/* TAB 4: DIGITAL ASSET (PDF) */}
        {activeTab === 'digital' && (
          <div className="space-y-5 animate-in fade-in">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Protected Digital Product Security (Step 3 Verified)</span>
              </div>
              <p>
                PDF assets configured here are strictly gatekept behind the server-authoritative <code>/api/download</code> endpoint.
                Public visitors cannot view or scrape this asset without a verified PAID order.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Sample / Download Filename
              </label>
              <input
                type="text"
                value={form.samplePdfName}
                onChange={(e) => updateField('samplePdfName', e.target.value)}
                placeholder="Xylem-IELTS-Full-Preparation-Guide.pdf"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono"
              />
            </div>

            {/* Current Attached PDF Status */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.pdfUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {form.pdfUrl ? 'Authenticated PDF Attached' : 'No Custom PDF Linked'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {form.pdfUrl ? `Resource ready for paid fulfillment (${form.samplePdfName})` : 'Attach a genuine PDF below'}
                  </p>
                </div>
              </div>

              {form.pdfUrl && (
                <button
                  type="button"
                  onClick={() => {
                    updateField('pdfUrl', '');
                    showToast('PDF unlinked from this book', 'info');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  Unlink PDF
                </button>
              )}
            </div>

            {/* Upload PDF File */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Attach Local PDF Document (.pdf)
              </label>
              <input
                type="file"
                ref={pdfInputRef}
                onChange={handlePdfUpload}
                accept=".pdf,application/pdf"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            {/* Or External Storage URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Or Protected Cloud Storage / Upstream URL
              </label>
              <input
                type="url"
                value={form.pdfUrl?.startsWith('data:') ? '' : form.pdfUrl}
                onChange={(e) => updateField('pdfUrl', e.target.value)}
                placeholder="https://storage.xylemlearning.com/secure/ielts-guide.pdf"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono"
              />
            </div>
          </div>
        )}

        {/* TAB 5: CURRICULUM & WHAT YOU GET */}
        {activeTab === 'curriculum' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Features List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Key Features (Bullet points)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="e.g. 500+ Practice Questions with Solutions"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (featureInput.trim()) {
                        updateField('features', [...(form.features || []), featureInput.trim()]);
                        setFeatureInput('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (featureInput.trim()) {
                      updateField('features', [...(form.features || []), featureInput.trim()]);
                      setFeatureInput('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                {(form.features || []).map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-800 border border-slate-200">
                    <span>• {f}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(form.features || [])];
                        next.splice(i, 1);
                        updateField('features', next);
                      }}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* What You Get List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                What You Get (Inclusions)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={whatYouGetInput}
                  onChange={(e) => setWhatYouGetInput(e.target.value)}
                  placeholder="e.g. 10 Full-Length Mock Tests with Scoring Rubrics"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (whatYouGetInput.trim()) {
                        updateField('whatYouGet', [...(form.whatYouGet || []), whatYouGetInput.trim()]);
                        setWhatYouGetInput('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (whatYouGetInput.trim()) {
                      updateField('whatYouGet', [...(form.whatYouGet || []), whatYouGetInput.trim()]);
                      setWhatYouGetInput('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                {(form.whatYouGet || []).map((w, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-800 border border-slate-200">
                    <span>✓ {w}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(form.whatYouGet || [])];
                        next.splice(i, 1);
                        updateField('whatYouGet', next);
                      }}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ADD-ONS & DEALS */}
        {activeTab === 'addons' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Buy 2 Get 3rd Free Toggle */}
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                  Buy 2 Get 3rd Add-on FREE Deal
                </h4>
                <p className="text-xs text-purple-800">
                  When enabled, purchasing any 2 add-on modules automatically awards the 3rd lowest priced add-on for free.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.buy2Get3rdFree}
                onChange={(e) => updateField('buy2Get3rdFree', e.target.checked)}
                className="w-5 h-5 accent-purple-600 cursor-pointer"
              />
            </div>

            {/* Addons List */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Configured Add-ons
              </label>

              {(form.addons || []).map((addon, idx) => (
                <div key={addon.id || idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-medium text-slate-600">Add-on Name</label>
                    <input
                      type="text"
                      value={addon.name}
                      onChange={(e) => {
                        const next = [...(form.addons || [])];
                        next[idx] = { ...addon, name: e.target.value };
                        updateField('addons', next);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Price (₹)</label>
                    <input
                      type="number"
                      value={addon.price}
                      onChange={(e) => {
                        const newPrice = Math.max(0, parseInt(e.target.value) || 0);
                        const next = [...(form.addons || [])];
                        next[idx] = { ...addon, price: newPrice };
                        setForm((prev) => {
                          const updatedPrices = { ...prev.prices };
                          if (addon.id === 'digital' || addon.deliveryOption === 'digital') {
                            const orig = updatedPrices.digital?.originalPrice || newPrice;
                            const discount = orig > newPrice ? Math.round(((orig - newPrice) / orig) * 100) : 0;
                            updatedPrices.digital = { ...updatedPrices.digital, price: newPrice, originalPrice: orig, discountPercent: discount };
                          } else if (addon.id === 'physical' || addon.deliveryOption === 'physical') {
                            const orig = updatedPrices.physical?.originalPrice || newPrice;
                            const discount = orig > newPrice ? Math.round(((orig - newPrice) / orig) * 100) : 0;
                            updatedPrices.physical = { ...updatedPrices.physical, price: newPrice, originalPrice: orig, discountPercent: discount };
                          }
                          return {
                            ...prev,
                            prices: updatedPrices,
                            addons: next,
                          };
                        });
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Format</label>
                    <select
                      value={addon.deliveryOption || 'digital'}
                      onChange={(e) => {
                        const next = [...(form.addons || [])];
                        next[idx] = { ...addon, deliveryOption: e.target.value as any };
                        updateField('addons', next);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="digital">Digital (PDF)</option>
                      <option value="physical">Physical (Printed)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: MARKETING & DISPLAY */}
        {activeTab === 'display' && (
          <div className="space-y-5 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="bestSeller"
                  checked={form.isBestSeller}
                  onChange={(e) => updateField('isBestSeller', e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <label htmlFor="bestSeller" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Featured Bestseller Badge
                </label>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="isNew"
                  checked={form.isNew}
                  onChange={(e) => updateField('isNew', e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <label htmlFor="isNew" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  New Release 2026 Edition Badge
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Total Book Pages
                </label>
                <input
                  type="number"
                  value={form.totalPages}
                  onChange={(e) => updateField('totalPages', parseInt(e.target.value) || 280)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50"
                />
              </div>


            </div>
          </div>
        )}
      </form>

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this product form. Navigating away now will discard all modified information."
        confirmLabel="Discard & Leave"
        cancelLabel="Continue Editing"
        isDanger={true}
        onConfirm={() => {
          setShowCancelModal(false);
          onCancel();
        }}
        onCancel={() => setShowCancelModal(false)}
      />
    </div>
  );
};
