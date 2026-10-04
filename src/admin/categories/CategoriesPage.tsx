import React, { useState } from 'react';
import {
  Layers,
  Edit3,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  ArrowRight,
  Palette,
  Check,
  Sparkles,
} from 'lucide-react';
import { ExamPath, ExamCategory, CatalogBannerConfig } from '../../types';
import { uploadImageToCloud } from '../../utils/cloudSync';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { CatalogBannerEditor } from './CatalogBannerEditor';
import { useShop } from '../../context/ShopContext';

const ARROW_COLOR_PRESETS = [
  { label: 'Teal (Default)', hex: '#00a375' },
  { label: 'Emerald', hex: '#00875a' },
  { label: 'Brand Navy', hex: '#0a2540' },
  { label: 'Sky Blue', hex: '#0284c7' },
  { label: 'Violet', hex: '#7c3aed' },
  { label: 'Rose Red', hex: '#e11d48' },
  { label: 'Sunset Orange', hex: '#ea580c' },
  { label: 'Amber Gold', hex: '#d97706' },
  { label: 'Dark Slate', hex: '#334155' },
];

const BADGE_COLOR_PRESETS = [
  { label: 'Deep Navy', hex: '#071d36' },
  { label: 'Forest Green', hex: '#00875a' },
  { label: 'Midnight Blue', hex: '#0f172a' },
  { label: 'Deep Crimson', hex: '#991b1b' },
  { label: 'Royal Indigo', hex: '#312e81' },
  { label: 'Teal Ocean', hex: '#115e59' },
  { label: 'Rich Bronze', hex: '#b45309' },
  { label: 'Imperial Purple', hex: '#581c87' },
  { label: 'Charcoal', hex: '#1e293b' },
];

const EXAM_IMAGE_PRESETS: { [key: string]: { label: string; url: string }[] } = {
  IELTS: [
    { label: 'Big Ben & London (Default)', url: '/images/exams/ielts.jpg' },
    { label: 'Tower Bridge & Thames', url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&q=80&w=1200' },
    { label: 'London Westminster', url: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&q=80&w=1200' },
  ],
  OET: [
    { label: 'Hospital Corridor (Default)', url: '/images/exams/oet.jpg' },
    { label: 'Medical Consultation Clinic', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200' },
    { label: 'Healthcare & Stethoscope', url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=1200' },
  ],
  PTE: [
    { label: 'Skyline & Jetliner (Default)', url: '/images/exams/pte.jpg' },
    { label: 'Modern Metro Skyline', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1200' },
    { label: 'Global Airport & Horizons', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=1200' },
  ],
  German: [
    { label: 'Berlin Cathedral (Default)', url: '/images/exams/german.jpg' },
    { label: 'Brandenburg Gate Berlin', url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&q=80&w=1200' },
    { label: 'German Historic Castle', url: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&q=80&w=1200' },
  ],
};

interface CategoriesPageProps {
  examPaths: ExamPath[];
  onUpdateExamPath: (category: ExamCategory, updated: Partial<ExamPath>) => boolean | Promise<boolean>;
  onDeleteExamPath?: (category: ExamCategory) => boolean | Promise<boolean>;
  onResetDefaults: () => boolean | Promise<boolean>;
  catalogBanner?: CatalogBannerConfig;
  onUpdateCatalogBanner?: (updated: Partial<CatalogBannerConfig>) => Promise<boolean> | void;
  onResetCatalogBanner?: () => Promise<boolean> | void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  examPaths,
  onUpdateExamPath,
  onDeleteExamPath,
  onResetDefaults,
  catalogBanner,
  onUpdateCatalogBanner,
  onResetCatalogBanner,
  showToast,
}) => {
  const shop = useShop();
  const activeCatalogBanner = catalogBanner || shop.catalogBanner;
  const activeUpdateBanner = onUpdateCatalogBanner || shop.updateCatalogBanner;
  const activeResetBanner = onResetCatalogBanner || shop.resetCatalogBannerToDefault;

  const [activeTab, setActiveTab] = useState<'cards' | 'banner'>('cards');
  const [editingCategory, setEditingCategory] = useState<ExamCategory | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [categoryName, setCategoryName] = useState<string>('IELTS');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [badgeText, setBadgeText] = useState('');
  const [isMedicalCross, setIsMedicalCross] = useState(false);
  const [showBadge, setShowBadge] = useState<boolean>(true);
  const [bgImage, setBgImage] = useState('/images/exams/ielts.jpg');
  const [arrowColor, setArrowColor] = useState('#00a375');
  const [badgeColor, setBadgeColor] = useState('#071d36');
  const [scriptWordsText, setScriptWordsText] = useState('Study, Work, Settle');
  const [isUploading, setIsUploading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamCategory | null>(null);

  const startEdit = (path: ExamPath) => {
    setIsAddingNew(false);
    setEditingCategory(path.category);
    setCategoryName(path.category);
    setTitle(path.title);
    setDescription(path.description);
    setBadgeText(path.badgeText || '');
    setIsMedicalCross(Boolean(path.isMedicalCross));
    setShowBadge(path.showBadge !== false);
    setBgImage(path.bgImage || '/images/exams/ielts.jpg');
    setArrowColor(path.arrowColor || '#00a375');
    setBadgeColor(path.badgeColor || (path.isMedicalCross ? '#00875a' : '#071d36'));
    setScriptWordsText((path.scriptWords || []).join(', '));
  };

  const startAddNew = () => {
    setIsAddingNew(true);
    setEditingCategory('IELTS');
    setCategoryName('IELTS');
    setCustomCategoryInput('');
    setTitle('New Exam Prep Pathway');
    setDescription('Build targeted skills and crack your target score.');
    setBadgeText('NEW');
    setIsMedicalCross(false);
    setShowBadge(true);
    setBgImage('/images/exams/ielts.jpg');
    setArrowColor('#00a375');
    setBadgeColor('#071d36');
    setScriptWordsText('Learn, Practice, Achieve');
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadImageToCloud(file, `category_${(categoryName || 'custom').toLowerCase()}`);
      setBgImage(url);
      showToast('Card background image uploaded to Cloudinary!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'warning');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedName = isAddingNew
      ? (categoryName === 'Other' ? customCategoryInput.trim() : categoryName.trim())
      : (editingCategory || categoryName);

    const targetCategory = resolvedName as ExamCategory;

    if (!targetCategory) {
      showToast('Please select or enter an exam category.', 'warning');
      return;
    }

    const scriptWords = scriptWordsText
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);

    const saved = await onUpdateExamPath(targetCategory, {
      title: title.trim(),
      description: description.trim(),
      badgeText: badgeText.trim(),
      isMedicalCross,
      showBadge,
      bgImage: bgImage.trim() || '/images/exams/ielts.jpg',
      arrowColor: arrowColor.trim() || '#00a375',
      badgeColor: badgeColor.trim() || '#071d36',
      scriptWords: scriptWords.length > 0 ? scriptWords : ['Study', 'Work', 'Settle'],
      redirectTarget: 'catalog',
    });

    if (saved) {
      setEditingCategory(null);
      setIsAddingNew(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Category Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('cards')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'cards'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-slate-700" />
          <span>Homepage Category Cards</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200/70 text-slate-700 font-bold">
            {examPaths.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'banner'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Catalog Hero Banner</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold">
            Dual Image &amp; Colors
          </span>
        </button>
      </div>

      {activeTab === 'banner' ? (
        <CatalogBannerEditor
          catalogBanner={activeCatalogBanner}
          onUpdateCatalogBanner={activeUpdateBanner}
          onResetCatalogBanner={activeResetBanner}
          showToast={showToast}
        />
      ) : (
        <>
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] flex items-center gap-2">
                <span>Exam Category Showcase Cards</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Real-time Sync
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure showcase pathways featured on the storefront homepage. Customize icon colors, titles, badges, and backgrounds with instant cross-tab live synchronization.
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={startAddNew}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#00875a] hover:bg-[#00734c] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Showcase Card</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>


      {/* Editing / Adding Modal if Active */}
      {(editingCategory || isAddingNew) && (
        <div className="bg-white rounded-3xl border-2 border-emerald-500 shadow-xl p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-150">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  {isAddingNew ? 'Add New Category Showcase Card' : `Edit Category Card: ${editingCategory}`}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Select custom colors for the arrow button and badge icon below. Changes update in real-time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setIsAddingNew(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Form Controls */}
            <div className="lg:col-span-2 space-y-4">
              {/* Category selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Exam Category
                  </label>
                  {isAddingNew ? (
                    <div className="space-y-1.5">
                      <select
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900"
                      >
                        <option value="IELTS">IELTS</option>
                        <option value="OET">OET</option>
                        <option value="PTE">PTE</option>
                        <option value="German">German</option>
                        <option value="Other">Other / Custom</option>
                      </select>
                      {categoryName === 'Other' && (
                        <input
                          type="text"
                          value={customCategoryInput}
                          onChange={(e) => setCustomCategoryInput(e.target.value)}
                          placeholder="Enter custom category name (e.g. TOEFL)"
                          required
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={categoryName}
                      disabled
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Card Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. IELTS Master Prep"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Card Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short tagline or summary for this pathway"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white leading-relaxed"
                />
              </div>

              {/* Badge Visibility Toggle & Badge Configuration */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      Top-Left Circular Badge Icon
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Turn on or turn off the circular badge icon (e.g. GB, +, PTE, DE)
                    </span>
                  </div>

                  {/* Toggle Button */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${showBadge ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {showBadge ? 'Badge ON' : 'Badge OFF'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showBadge}
                      onClick={() => setShowBadge((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        showBadge ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          showBadge ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {showBadge ? (
                  <div className="pt-3 border-t border-slate-200/70 space-y-3">
                    {/* Badge text & Medical cross toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                          Badge Tag Text (e.g. GB, PTE, DE)
                        </label>
                        <input
                          type="text"
                          value={badgeText}
                          onChange={(e) => setBadgeText(e.target.value)}
                          disabled={isMedicalCross}
                          placeholder="e.g. GB"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white disabled:opacity-50"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isMedicalCross}
                            onChange={(e) => setIsMedicalCross(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                          />
                          <span>Display Medical Cross (+) Icon</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-500 italic">
                    Badge icon is currently turned off and will be hidden on the storefront card.
                  </div>
                )}
              </div>

              {/* COLOR SECTION 1: Arrow Action Button Color (Bottom-Right Circle) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: arrowColor }}
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        Action Arrow Icon Color
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Bottom-right circular button with right arrow
                      </span>
                    </div>
                  </div>

                  {/* Native Picker + Hex preview */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={arrowColor}
                      onChange={(e) => setArrowColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer overflow-hidden p-0"
                      title="Choose custom color"
                    />
                    <input
                      type="text"
                      value={arrowColor}
                      onChange={(e) => setArrowColor(e.target.value)}
                      className="w-20 px-2 py-1 text-[11px] font-mono font-bold rounded-lg border border-slate-300 bg-white uppercase text-center"
                    />
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ARROW_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setArrowColor(preset.hex)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                        arrowColor.toLowerCase() === preset.hex.toLowerCase()
                          ? 'border-slate-800 bg-white text-slate-900 shadow-xs ring-1 ring-slate-800'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.label}</span>
                      {arrowColor.toLowerCase() === preset.hex.toLowerCase() && (
                        <Check className="w-3 h-3 text-slate-900" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* COLOR SECTION 2: Top Badge Icon Color (Top-Left Circle) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: badgeColor }}
                      className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-xs transition-colors shrink-0"
                    >
                      {isMedicalCross ? '+' : (badgeText || 'GB')}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        Top Badge Icon Color
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Top-left circular indicator icon (e.g. GB, +, PTE, DE)
                      </span>
                    </div>
                  </div>

                  {/* Native Picker + Hex preview */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer overflow-hidden p-0"
                      title="Choose custom badge color"
                    />
                    <input
                      type="text"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      className="w-20 px-2 py-1 text-[11px] font-mono font-bold rounded-lg border border-slate-300 bg-white uppercase text-center"
                    />
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {BADGE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setBadgeColor(preset.hex)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                        badgeColor.toLowerCase() === preset.hex.toLowerCase()
                          ? 'border-slate-800 bg-white text-slate-900 shadow-xs ring-1 ring-slate-800'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.label}</span>
                      {badgeColor.toLowerCase() === preset.hex.toLowerCase() && (
                        <Check className="w-3 h-3 text-slate-900" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Image Selection */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Background Image
                </label>
                <div className="flex items-center gap-3">
                  <img
                    src={bgImage}
                    alt="Preview"
                    className="w-20 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-900"
                  />
                  <div className="flex-1 space-y-1.5">
                    <select
                      value={bgImage}
                      onChange={(e) => setBgImage(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                    >
                      {(EXAM_IMAGE_PRESETS[categoryName] || EXAM_IMAGE_PRESETS['IELTS'] || []).map((preset, idx) => (
                        <option key={idx} value={preset.url}>
                          {preset.label}
                        </option>
                      ))}
                    </select>

                    <label className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>{isUploading ? 'Uploading...' : 'Upload Custom Image to Cloudinary'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleUploadBg}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Script Words */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Top-Right Cursive Script Words (Comma separated)
                </label>
                <input
                  type="text"
                  value={scriptWordsText}
                  onChange={(e) => setScriptWordsText(e.target.value)}
                  placeholder="e.g. Study, Work, Settle"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
                />
              </div>
            </div>

            {/* Right Col: Live Card Preview */}
            <div className="flex flex-col items-center justify-between p-4 bg-slate-100/70 rounded-2xl border border-slate-200">
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Live Storefront Preview</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Real-time</span>
                </div>

                {/* Simulated Homepage Card */}
                <div className="relative w-full h-72 rounded-[22px] overflow-hidden shadow-md border border-slate-300 flex flex-col justify-between bg-slate-900 select-none">
                  {/* Background Image */}
                  <img
                    src={bgImage}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061e38] via-[#061e38]/70 via-45% to-transparent" />

                  {/* Top Row: Left Badge & Right Calligraphic Script */}
                  <div className="relative z-10 p-3.5 flex items-start justify-between">
                    {/* Top-Left Circular Badge with DYNAMIC BADGE COLOR */}
                    {showBadge ? (
                      <div
                        style={{ backgroundColor: badgeColor }}
                        className="w-8 h-8 rounded-full text-white font-extrabold text-[11px] flex items-center justify-center shadow-md border border-white/20 transition-colors"
                      >
                        {isMedicalCross ? '+' : (badgeText || 'GB')}
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Top-Right Script */}
                    <div className="font-script text-sm font-bold text-[#00875a] leading-tight text-right transform -rotate-3 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                      {scriptWordsText.split(',').slice(0, 3).map((w, i) => (
                        <div key={i}>{w.trim()}</div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Row: Title, Description & Action Button with DYNAMIC ARROW COLOR */}
                  <div className="relative z-10 p-3.5 pt-0 flex items-end justify-between gap-2 text-white">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif] text-white leading-tight truncate">
                        {title || 'Category Title'}
                      </h4>
                      <p className="text-[11px] text-slate-200/90 leading-tight font-['DM_Sans',sans-serif] mt-1 line-clamp-2">
                        {description || 'Pathway description'}
                      </p>
                    </div>

                    {/* Bottom-Right Circular Button with DYNAMIC ARROW COLOR */}
                    <div
                      style={{ backgroundColor: arrowColor }}
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg shrink-0 mb-0.5 transition-colors"
                    >
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex items-center gap-2 pt-4 border-t border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setIsAddingNew(false);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#00875a] hover:bg-[#00734c] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isAddingNew ? 'Add Card' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {examPaths.map((path) => {
          const cardArrowColor = path.arrowColor || '#00a375';
          const cardBadgeColor = path.badgeColor || (path.isMedicalCross ? '#00875a' : '#071d36');

          return (
            <div
              key={path.category}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col justify-between group hover:shadow-md transition-shadow"
            >
              <div>
                {/* Card Image Banner */}
                <div className="h-44 relative overflow-hidden bg-slate-900">
                  <img
                    src={path.bgImage}
                    alt={path.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  {/* Top Bar with Category Tag and Top Badge Icon */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-xs text-white px-2 py-0.5 rounded-full border border-white/30 shadow-xs">
                        {path.category}
                      </span>
                    </div>

                    {/* Circular Badge Icon displaying actual badgeColor or Badge OFF state */}
                    {path.showBadge !== false ? (
                      <div
                        style={{ backgroundColor: cardBadgeColor }}
                        className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center border border-white/25 shadow-md transition-colors"
                        title={`Badge Color: ${cardBadgeColor}`}
                      >
                        {path.isMedicalCross ? '+' : (path.badgeText || path.category.slice(0, 2))}
                      </div>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-300 bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/10">
                        Badge OFF
                      </span>
                    )}
                  </div>

                  {/* Bottom Row displaying Title and Arrow Icon with actual arrowColor */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <h4 className="text-base font-extrabold text-white font-['Plus_Jakarta_Sans',sans-serif] leading-tight truncate">
                      {path.title}
                    </h4>

                    {/* Circular Arrow Button displaying actual arrowColor */}
                    <div
                      style={{ backgroundColor: cardArrowColor }}
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md transition-colors shrink-0"
                      title={`Arrow Color: ${cardArrowColor}`}
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Card Details & Color Swatches */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block border border-emerald-200">
                        {path.badgeText || (path.isMedicalCross ? 'HEALTHCARE' : 'OFFICIAL')}
                      </span>

                      {/* Quick 1-click real-time badge toggle */}
                      <button
                        type="button"
                        onClick={() => onUpdateExamPath(path.category, { showBadge: path.showBadge === false ? true : false })}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                          path.showBadge !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                        }`}
                        title="Click to toggle badge on/off in real-time"
                      >
                        Badge: {path.showBadge !== false ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* Color Swatch Indicators */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1" title={`Badge Color: ${cardBadgeColor}`}>
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-2xs"
                          style={{ backgroundColor: cardBadgeColor }}
                        />
                        <span className="font-mono text-[9px]">{cardBadgeColor}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1" title={`Arrow Color: ${cardArrowColor}`}>
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-2xs"
                          style={{ backgroundColor: cardArrowColor }}
                        />
                        <span className="font-mono text-[9px]">{cardArrowColor}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {path.description}
                  </p>
                </div>
              </div>

              {/* Card Actions */}
              <div className="p-4 pt-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(path)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Colors & Content</span>
                </button>

                {onDeleteExamPath && examPaths.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(path.category)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                    title={`Delete ${path.category} card`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset Exam Category Cards?"
        message="Are you sure you want to reset all exam category cards and hero images back to system defaults? Custom colors, titles, and images will be restored to original settings."
        confirmLabel="Reset to Defaults"
        cancelLabel="Cancel"
        isDanger={false}
        onConfirm={async () => {
          const reset = await onResetDefaults();
          if (reset) setShowResetModal(false);
        }}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title={`Remove ${deleteTarget} Showcase Card?`}
        message={`Are you sure you want to remove the ${deleteTarget} category card from the homepage? This will be removed immediately from the live storefront.`}
        confirmLabel="Remove Card"
        cancelLabel="Cancel"
        isDanger={true}
        onConfirm={async () => {
          if (deleteTarget && onDeleteExamPath) {
            const deleted = await onDeleteExamPath(deleteTarget);
            if (!deleted) return;
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
        </>
      )}
    </div>

  );
};
