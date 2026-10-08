import React, { useEffect, useMemo, useState } from 'react';
import { Image, RotateCcw, Save, Upload } from 'lucide-react';
import { Book, HomeSpotlightConfig } from '../../types';
import { DEFAULT_HOME_SPOTLIGHT } from '../../data/homeSpotlight';
import { uploadImageToCloud } from '../../utils/cloudSync';

interface HomeSpotlightEditorProps {
  books: Book[];
  homeSpotlight?: HomeSpotlightConfig;
  onUpdateHomeSpotlight: (updated: Partial<HomeSpotlightConfig>) => Promise<boolean> | void;
  onResetHomeSpotlight?: () => Promise<boolean> | void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const HomeSpotlightEditor: React.FC<HomeSpotlightEditorProps> = ({
  books,
  homeSpotlight,
  onUpdateHomeSpotlight,
  onResetHomeSpotlight,
  showToast,
}) => {
  const activeConfig = useMemo(() => ({ ...DEFAULT_HOME_SPOTLIGHT, ...(homeSpotlight || {}) }), [homeSpotlight]);
  const [enabled, setEnabled] = useState(activeConfig.enabled !== false);
  const [productId, setProductId] = useState(activeConfig.productId || books[0]?.id || '');
  const [imageUrl, setImageUrl] = useState(activeConfig.imageUrl || '');
  const [badgeText, setBadgeText] = useState(activeConfig.badgeText || '');
  const [secondaryBadgeText, setSecondaryBadgeText] = useState(activeConfig.secondaryBadgeText || '');
  const [title, setTitle] = useState(activeConfig.title || '');
  const [description, setDescription] = useState(activeConfig.description || '');
  const [price, setPrice] = useState(activeConfig.price?.toString() || '');
  const [originalPrice, setOriginalPrice] = useState(activeConfig.originalPrice?.toString() || '');
  const [buttonText, setButtonText] = useState(activeConfig.buttonText || 'Buy Now');
  const [backgroundColor, setBackgroundColor] = useState(activeConfig.backgroundColor || '#ffffff');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const selectedBook = books.find((book) => book.id === productId) || books[0];
  const previewImage = imageUrl || selectedBook?.coverImage || selectedBook?.imageUrl || selectedBook?.images?.[0] || '';
  const previewTitle = title || selectedBook?.title || 'Featured product title';
  const previewDescription = description || selectedBook?.description || 'Featured product description';
  const previewPrice = price || String(selectedBook?.prices?.digital?.price ?? 199);
  const previewOriginal = originalPrice || String(selectedBook?.prices?.digital?.originalPrice ?? 599);

  useEffect(() => {
    setEnabled(activeConfig.enabled !== false);
    setProductId(activeConfig.productId || books[0]?.id || '');
    setImageUrl(activeConfig.imageUrl || '');
    setBadgeText(activeConfig.badgeText || '');
    setSecondaryBadgeText(activeConfig.secondaryBadgeText || '');
    setTitle(activeConfig.title || '');
    setDescription(activeConfig.description || '');
    setPrice(activeConfig.price?.toString() || '');
    setOriginalPrice(activeConfig.originalPrice?.toString() || '');
    setButtonText(activeConfig.buttonText || 'Buy Now');
    setBackgroundColor(activeConfig.backgroundColor || '#ffffff');
  }, [activeConfig, books]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadImageToCloud(file, 'homepage_spotlight');
      setImageUrl(url);
      showToast('Spotlight image uploaded.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Spotlight image upload failed.', 'warning');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const parseOptionalPrice = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateHomeSpotlight({
        enabled,
        productId,
        imageUrl: imageUrl.trim(),
        badgeText: badgeText.trim(),
        secondaryBadgeText: secondaryBadgeText.trim(),
        title: title.trim(),
        description: description.trim(),
        price: parseOptionalPrice(price),
        originalPrice: parseOptionalPrice(originalPrice),
        buttonText: buttonText.trim() || 'Buy Now',
        backgroundColor: backgroundColor.trim() || '#ffffff',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (onResetHomeSpotlight) {
      await onResetHomeSpotlight();
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <form onSubmit={handleSave} className="xl:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              Homepage Best Product Spotlight
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Customize the large product section below the homepage hero.
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Featured Product">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Button Text">
            <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className={inputClass} placeholder="Buy Now" />
          </Field>
        </div>

        <Field label="Override Image URL">
          <div className="flex gap-2">
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} placeholder="Leave empty to use product image" />
            <label className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800">
              <Upload className="w-3.5 h-3.5" />
              {isUploading ? 'Uploading' : 'Upload'}
              <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" disabled={isUploading} />
            </label>
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary Badge">
            <input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} className={inputClass} placeholder="Best Product" />
          </Field>
          <Field label="Secondary Badge">
            <input value={secondaryBadgeText} onChange={(e) => setSecondaryBadgeText(e.target.value)} className={inputClass} placeholder="Instant PDF" />
          </Field>
        </div>

        <Field label="Title Override">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Leave empty to use product title" />
        </Field>

        <Field label="Description Override">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} placeholder="Leave empty to use product description" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Price Override">
            <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="199" />
          </Field>
          <Field label="Original Price">
            <input type="number" min="0" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} className={inputClass} placeholder="599" />
          </Field>
          <Field label="Background">
            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-full h-10 rounded-xl border border-slate-300 bg-white p-1" />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875a] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Spotlight'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
        </div>
      </form>

      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
          <Image className="w-4 h-4 text-emerald-600" />
          Live Preview
        </div>
        <div className="overflow-hidden rounded-2xl border border-emerald-100" style={{ backgroundColor }}>
          <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/60 p-4">
            <div className="aspect-[16/7.2] rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
              {previewImage ? (
                <img src={previewImage} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="text-xs text-slate-400">No image selected</div>
              )}
            </div>
          </div>
          <div className="p-5 space-y-4 bg-white">
            <div className="flex flex-wrap gap-2">
              {badgeText && <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00875a] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">{badgeText}</span>}
              {secondaryBadgeText && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">{secondaryBadgeText}</span>}
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[#0a2540] leading-tight">{previewTitle}</h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">{previewDescription}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-[#0a2540]">₹{previewPrice}</span>
              {Number(previewOriginal) > Number(previewPrice) && <span className="text-xs text-slate-400 line-through font-semibold">₹{previewOriginal}</span>}
            </div>
            <button type="button" className="inline-flex px-5 py-2.5 rounded-xl bg-[#00875a] text-white text-xs font-bold">
              {buttonText || 'Buy Now'} ₹{previewPrice}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-bold text-slate-700">{label}</span>
    {children}
  </label>
);
