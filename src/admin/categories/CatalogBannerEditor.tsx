import React, { useState, useEffect } from 'react';
import {
  Upload,
  RotateCcw,
  Sparkles,
  Monitor,
  Smartphone,
  Save,
  Palette,
  Check,
  Image as ImageIcon,
  Sliders,
  Type,
  Eye,
  Info,
} from 'lucide-react';
import { CatalogBannerConfig } from '../../types';
import { DEFAULT_CATALOG_BANNER } from '../../data/catalogBanner';
import { uploadImageToCloud } from '../../utils/cloudSync';

interface CatalogBannerEditorProps {
  catalogBanner?: CatalogBannerConfig;
  onUpdateCatalogBanner: (updated: Partial<CatalogBannerConfig>) => Promise<boolean> | void;
  onResetCatalogBanner?: () => Promise<boolean> | void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const DESKTOP_BANNER_PRESETS = [
  { label: 'Deep Blue Navy (Default Gradient)', url: '' },
  { label: 'Modern Digital Library', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=1600' },
  { label: 'Oxford Heritage University', url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1600' },
  { label: 'Exam Study Workspace', url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=1600' },
  { label: 'Minimalist Dark Geometry', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1600' },
];

const MOBILE_BANNER_PRESETS = [
  { label: 'Deep Blue Navy (Default Gradient)', url: '' },
  { label: 'Mobile Bookshelf Portrait', url: 'https://images.unsplash.com/photo-1507842229451-9f7a7ebf4f10?auto=format&fit=crop&q=80&w=800' },
  { label: 'Mobile Learning Desk', url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=800' },
  { label: 'Mobile Global Horizons', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=800' },
];

const TITLE_COLOR_PRESETS = [
  { label: 'Pure White (Default)', hex: '#ffffff' },
  { label: 'Emerald Mint', hex: '#34d399' },
  { label: 'Electric Sky', hex: '#38bdf8' },
  { label: 'Amber Gold', hex: '#fbbf24' },
  { label: 'Rose Pink', hex: '#f43f5e' },
  { label: 'Coral Flame', hex: '#fb923c' },
  { label: 'Soft Violet', hex: '#c084fc' },
];

const SUBTITLE_COLOR_PRESETS = [
  { label: 'Light Slate (Default)', hex: '#cbd5e1' },
  { label: 'Cool White', hex: '#f1f5f9' },
  { label: 'Soft Sky', hex: '#bae6fd' },
  { label: 'Pale Mint', hex: '#a7f3d0' },
  { label: 'Warm Gray', hex: '#e2e8f0' },
  { label: 'Amber Cream', hex: '#fef3c7' },
];

const BADGE_COLOR_PRESETS = [
  { label: 'Soft Slate (Default)', hex: '#e2e8f0' },
  { label: 'Pure White', hex: '#ffffff' },
  { label: 'Mint Glow', hex: '#6ee7b7' },
  { label: 'Sky Glow', hex: '#7dd3fc' },
  { label: 'Warm Amber', hex: '#fde68a' },
];

export const CatalogBannerEditor: React.FC<CatalogBannerEditorProps> = ({
  catalogBanner,
  onUpdateCatalogBanner,
  onResetCatalogBanner,
  showToast,
}) => {
  const activeConfig = catalogBanner || DEFAULT_CATALOG_BANNER;

  const [title, setTitle] = useState(activeConfig.title || DEFAULT_CATALOG_BANNER.title || 'Complete Exam Study Materials');
  const [subtitle, setSubtitle] = useState(activeConfig.subtitle || DEFAULT_CATALOG_BANNER.subtitle || '');
  const [desktopBgImage, setDesktopBgImage] = useState(activeConfig.desktopBgImage || '');
  const [mobileBgImage, setMobileBgImage] = useState(activeConfig.mobileBgImage || '');
  const [titleColor, setTitleColor] = useState(activeConfig.titleColor || '#ffffff');
  const [subtitleColor, setSubtitleColor] = useState(activeConfig.subtitleColor || '#cbd5e1');
  const [badgeTextColor, setBadgeTextColor] = useState(activeConfig.badgeTextColor || '#e2e8f0');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(activeConfig.overlayOpacity ?? 50);
  const [featurePillsText, setFeaturePillsText] = useState<string>(
    (activeConfig.featurePills || DEFAULT_CATALOG_BANNER.featurePills || []).join(', ')
  );

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isUploadingDesktop, setIsUploadingDesktop] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if remote prop changes
  useEffect(() => {
    if (catalogBanner) {
      setTitle(catalogBanner.title ?? DEFAULT_CATALOG_BANNER.title ?? 'Complete Exam Study Materials');
      setSubtitle(catalogBanner.subtitle ?? DEFAULT_CATALOG_BANNER.subtitle ?? '');
      setDesktopBgImage(catalogBanner.desktopBgImage ?? '');
      setMobileBgImage(catalogBanner.mobileBgImage ?? '');
      setTitleColor(catalogBanner.titleColor ?? '#ffffff');
      setSubtitleColor(catalogBanner.subtitleColor ?? '#cbd5e1');
      setBadgeTextColor(catalogBanner.badgeTextColor ?? '#e2e8f0');
      setOverlayOpacity(catalogBanner.overlayOpacity ?? 50);
      setFeaturePillsText((catalogBanner.featurePills ?? DEFAULT_CATALOG_BANNER.featurePills ?? []).join(', '));
    }
  }, [catalogBanner]);

  const handleDesktopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (JPG, PNG, WebP)', 'warning');
      return;
    }

    try {
      setIsUploadingDesktop(true);
      const url = await uploadImageToCloud(file);
      setDesktopBgImage(url);
      showToast('Desktop background image uploaded successfully!', 'success');
    } catch (err: any) {
      showToast(`Upload failed: ${err?.message || 'Server error'}`, 'warning');
    } finally {
      setIsUploadingDesktop(false);
      e.target.value = '';
    }
  };

  const handleMobileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (JPG, PNG, WebP)', 'warning');
      return;
    }

    try {
      setIsUploadingMobile(true);
      const url = await uploadImageToCloud(file);
      setMobileBgImage(url);
      showToast('Mobile-optimized background image uploaded successfully!', 'success');
    } catch (err: any) {
      showToast(`Upload failed: ${err?.message || 'Server error'}`, 'warning');
    } finally {
      setIsUploadingMobile(false);
      e.target.value = '';
    }
  };

  const parsedPills = featurePillsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateCatalogBanner({
        title: title.trim() || 'Complete Exam Study Materials',
        subtitle: subtitle.trim(),
        desktopBgImage: desktopBgImage.trim(),
        mobileBgImage: mobileBgImage.trim(),
        titleColor: titleColor.trim() || '#ffffff',
        subtitleColor: subtitleColor.trim() || '#cbd5e1',
        badgeTextColor: badgeTextColor.trim() || '#e2e8f0',
        overlayOpacity,
        featurePills: parsedPills.length > 0 ? parsedPills : DEFAULT_CATALOG_BANNER.featurePills,
      });
      showToast('Catalog hero banner settings saved and synchronized!', 'success');
    } catch (err: any) {
      showToast(`Save failed: ${err?.message || 'Error'}`, 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (onResetCatalogBanner) {
      await onResetCatalogBanner();
    }
    setTitle(DEFAULT_CATALOG_BANNER.title || 'Complete Exam Study Materials');
    setSubtitle(DEFAULT_CATALOG_BANNER.subtitle || '');
    setDesktopBgImage('');
    setMobileBgImage('');
    setTitleColor('#ffffff');
    setSubtitleColor('#cbd5e1');
    setBadgeTextColor('#e2e8f0');
    setOverlayOpacity(50);
    setFeaturePillsText((DEFAULT_CATALOG_BANNER.featurePills || []).join(', '));
    showToast('Reset banner settings to system defaults.', 'info');
  };

  const activePreviewImage = previewDevice === 'mobile'
    ? (mobileBgImage || desktopBgImage)
    : (desktopBgImage || mobileBgImage);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] flex items-center gap-2">
            <span>Catalog Hero Banner Customizer</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Live Real-time Sync
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customize dual background images (separate desktop &amp; mobile-optimized), title &amp; description text colors, and feature badges.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Banner Settings'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset to Defaults</span>
          </button>
        </div>
      </div>

      {/* Responsive Live Interactive Preview Box */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white text-xs font-bold font-['Plus_Jakarta_Sans',sans-serif]">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Interactive Live Banner Preview</span>
            <span className="text-[10px] font-normal text-slate-400">
              (Live updates instantly as you tweak controls below)
            </span>
          </div>

          {/* Device Preview Toggle */}
          <div className="inline-flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewDevice === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop View</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewDevice === 'mobile'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile View</span>
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex justify-center items-center py-2">
          <div
            className={`w-full transition-all duration-300 ${
              previewDevice === 'mobile' ? 'max-w-sm' : 'max-w-4xl'
            }`}
          >
            {/* The Target Banner Element */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0a2540] via-[#0d3356] to-[#081d33] p-6 sm:p-10 shadow-2xl isolation transition-all">
              {/* Background Image Layer */}
              {activePreviewImage && (
                <div className="absolute inset-0 pointer-events-none -z-10">
                  <img
                    src={activePreviewImage}
                    alt="Hero Banner Preview"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              )}

              {/* Overlay Tint */}
              <div
                className="absolute inset-0 pointer-events-none -z-10"
                style={{
                  backgroundColor: '#071829',
                  opacity: overlayOpacity / 100,
                }}
              />

              {/* Banner Content */}
              <div className="relative z-10 max-w-2xl space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {['All', 'IELTS', 'OET', 'PTE', 'German'].map((cat, idx) => (
                    <span
                      key={cat}
                      className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                        idx === 0
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-white/15 text-slate-200'
                      }`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                <h1
                  className="text-xl sm:text-3xl lg:text-4xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-tight"
                  style={{ color: titleColor }}
                >
                  {title || 'Complete Exam Study Materials'}
                </h1>

                <p
                  className="text-xs sm:text-sm text-slate-300 leading-relaxed font-['DM_Sans',sans-serif]"
                  style={{ color: subtitleColor }}
                >
                  {subtitle || 'Achieve your target score with expert-curated study materials, practice books, full-length mock exams, and verified strategies.'}
                </p>

                {/* Feature Badges */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 sm:pt-2">
                  {(parsedPills.length > 0 ? parsedPills : DEFAULT_CATALOG_BANNER.featurePills || []).map(
                    (pill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-[10px] sm:text-[11px] font-medium backdrop-blur-xs border px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg"
                        style={{
                          color: badgeTextColor,
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        ✓ {pill}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Active Device Indicator Tag */}
              <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-black/50 text-slate-300 px-2 py-0.5 rounded-md backdrop-blur-xs border border-white/10">
                {previewDevice === 'mobile' ? 'Mobile Active Image' : 'Desktop Active Image'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Form Controls */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Left Column: Dual Background Image Configuration */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              1. Dual Background Images (Desktop &amp; Mobile-Optimized)
            </h3>
          </div>

          {/* Desktop Image Setting */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-slate-700" />
                <label className="text-xs font-bold text-slate-900">
                  Desktop Background Image
                </label>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Desktop / Tablet Screens (≥640px)
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Shown to visitors browsing on laptops, desktops, and wide tablets. Landscape orientation recommended (e.g. 1920×600 or 16:9).
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={desktopBgImage}
                onChange={(e) => setDesktopBgImage(e.target.value)}
                placeholder="https://... or upload image"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white"
              />
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors shrink-0">
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>{isUploadingDesktop ? 'Uploading...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDesktopUpload}
                  disabled={isUploadingDesktop}
                  className="hidden"
                />
              </label>
              {desktopBgImage && (
                <button
                  type="button"
                  onClick={() => setDesktopBgImage('')}
                  className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Remove image (use default gradient)"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Presets for Desktop */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Quick Desktop Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DESKTOP_BANNER_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDesktopBgImage(preset.url)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all cursor-pointer ${
                      desktopBgImage === preset.url
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Image Setting */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <label className="text-xs font-bold text-slate-900">
                  Mobile-Optimized Background Image
                </label>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                Mobile Screens (&lt;640px)
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Shown exclusively to visitors on mobile devices. Tailored portrait or square images (e.g. 800×800 or 750×1000) keep the banner crisp without awkward cropping.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={mobileBgImage}
                onChange={(e) => setMobileBgImage(e.target.value)}
                placeholder="https://... or upload mobile image"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white"
              />
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors shrink-0">
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>{isUploadingMobile ? 'Uploading...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMobileUpload}
                  disabled={isUploadingMobile}
                  className="hidden"
                />
              </label>
              {mobileBgImage && (
                <button
                  type="button"
                  onClick={() => setMobileBgImage('')}
                  className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Remove mobile image"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Presets for Mobile */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Quick Mobile Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MOBILE_BANNER_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setMobileBgImage(preset.url)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all cursor-pointer ${
                      mobileBgImage === preset.url
                        ? 'bg-blue-50 border-blue-500 text-blue-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Overlay Darkening Opacity Slider */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700" />
                <label className="text-xs font-bold text-slate-900">
                  Background Readability Tint Opacity
                </label>
              </div>
              <span className="text-xs font-extrabold text-emerald-700">
                {overlayOpacity}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Darkens the background image so light headline and body text remain 100% sharp and easy to read on any photo.
            </p>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>0% (Transparent)</span>
              <span>50% (Recommended)</span>
              <span>90% (Dark Tint)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Text Colors & Banner Content */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Palette className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              2. Text Colors &amp; Content Customization
            </h3>
          </div>

          {/* Title Text & Title Color */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900">
                  Banner Headline Title
                </label>
                <span className="text-[10px] text-slate-400">
                  Defaults to &ldquo;Complete Exam Study Materials&rdquo;
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Complete Exam Study Materials"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900 focus:bg-white"
              />
            </div>

            {/* Title Color Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Headline Text Color</span>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shadow-xs"
                    style={{ backgroundColor: titleColor }}
                  />
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={titleColor}
                    onChange={(e) => setTitleColor(e.target.value)}
                    className="w-6 h-6 rounded-md cursor-pointer border-0 p-0"
                    title="Choose custom color"
                  />
                  <input
                    type="text"
                    value={titleColor}
                    onChange={(e) => setTitleColor(e.target.value)}
                    placeholder="#ffffff"
                    className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-300 font-mono text-center text-slate-800"
                  />
                </div>
              </div>

              {/* Title Color Presets */}
              <div className="flex flex-wrap gap-1.5">
                {TITLE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setTitleColor(preset.hex)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      titleColor.toLowerCase() === preset.hex.toLowerCase()
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subtitle Text & Subtitle Color */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-900">
                Banner Description Subtitle
              </label>
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
                placeholder="Achieve your target score with expert-curated study materials..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white resize-y"
              />
            </div>

            {/* Subtitle Color Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Subtitle Text Color</span>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shadow-xs"
                    style={{ backgroundColor: subtitleColor }}
                  />
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={subtitleColor}
                    onChange={(e) => setSubtitleColor(e.target.value)}
                    className="w-6 h-6 rounded-md cursor-pointer border-0 p-0"
                    title="Choose custom color"
                  />
                  <input
                    type="text"
                    value={subtitleColor}
                    onChange={(e) => setSubtitleColor(e.target.value)}
                    placeholder="#cbd5e1"
                    className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-300 font-mono text-center text-slate-800"
                  />
                </div>
              </div>

              {/* Subtitle Color Presets */}
              <div className="flex flex-wrap gap-1.5">
                {SUBTITLE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setSubtitleColor(preset.hex)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      subtitleColor.toLowerCase() === preset.hex.toLowerCase()
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Badges & Badge Text Color */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900">
                  Feature Badges (Checkmarks)
                </label>
                <span className="text-[10px] text-slate-400">
                  Comma separated
                </span>
              </div>
              <input
                type="text"
                value={featurePillsText}
                onChange={(e) => setFeaturePillsText(e.target.value)}
                placeholder="Complete Study Guides, Practice Tests & Mock Exams, Exam Tips & Strategies, Latest Exam Format"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 focus:bg-white"
              />
            </div>

            {/* Badge Text Color */}
            <div className="space-y-2 pt-2 border-t border-slate-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Badge Text Color</span>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shadow-xs"
                    style={{ backgroundColor: badgeTextColor }}
                  />
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={badgeTextColor}
                    onChange={(e) => setBadgeTextColor(e.target.value)}
                    className="w-6 h-6 rounded-md cursor-pointer border-0 p-0"
                    title="Choose badge text color"
                  />
                  <input
                    type="text"
                    value={badgeTextColor}
                    onChange={(e) => setBadgeTextColor(e.target.value)}
                    placeholder="#e2e8f0"
                    className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-300 font-mono text-center text-slate-800"
                  />
                </div>
              </div>

              {/* Badge Color Presets */}
              <div className="flex flex-wrap gap-1.5">
                {BADGE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setBadgeTextColor(preset.hex)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      badgeTextColor.toLowerCase() === preset.hex.toLowerCase()
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-2xl shadow-md transition-all cursor-pointer active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving & Broadcasting Changes...' : 'Save & Publish Banner Settings'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
