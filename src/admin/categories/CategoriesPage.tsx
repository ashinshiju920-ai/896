import React, { useState } from 'react';
import {
  Layers,
  Edit3,
  Upload,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { ExamPath, ExamCategory } from '../../types';
import { uploadImageToCloud } from '../../utils/cloudSync';
import { ConfirmationModal } from '../components/ConfirmationModal';

const EXAM_IMAGE_PRESETS: { [key in ExamCategory]?: { label: string; url: string }[] } = {
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
  onUpdateExamPath: (category: ExamCategory, updated: Partial<ExamPath>) => void;
  onResetDefaults: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  examPaths,
  onUpdateExamPath,
  onResetDefaults,
  showToast,
}) => {
  const [editingCategory, setEditingCategory] = useState<ExamCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const startEdit = (path: ExamPath) => {
    setEditingCategory(path.category);
    setTitle(path.title);
    setDescription(path.description);
    setBadgeText(path.badgeText || '');
    setBgImage(path.bgImage);
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCategory) return;

    setIsUploading(true);
    try {
      const url = await uploadImageToCloud(file, `category_${editingCategory.toLowerCase()}`);
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
    if (!editingCategory) return;

    await onUpdateExamPath(editingCategory, {
      title: title.trim(),
      description: description.trim(),
      badgeText: badgeText.trim(),
      bgImage: bgImage.trim(),
    });

    setEditingCategory(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            Exam Category Showcase Cards
          </h2>
          <p className="text-xs text-slate-500">
            Configure the 4 primary exam pathways featured on the storefront homepage and hero sections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset Cards to Default</span>
        </button>
      </div>

      {/* Editing Form Modal if Active */}
      {editingCategory && (
        <div className="bg-white rounded-3xl border-2 border-emerald-500/40 shadow-lg p-6 space-y-5 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Edit Category: {editingCategory}
            </h3>
            <button
              onClick={() => setEditingCategory(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Card Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Badge Tag Text</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g. BAND 8+ PATHWAY"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Card Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Background Image</label>
              <div className="flex items-center gap-3">
                <img
                  src={bgImage}
                  alt="Preview"
                  className="w-24 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 space-y-1.5">
                  <select
                    value={bgImage}
                    onChange={(e) => setBgImage(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                  >
                    {(EXAM_IMAGE_PRESETS[editingCategory] || []).map((preset, idx) => (
                      <option key={idx} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-3">
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
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#00875a] hover:bg-[#00734c] rounded-xl shadow-xs"
              >
                Save Category Card
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {examPaths.map((path) => (
          <div
            key={path.category}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col justify-between group hover:shadow-md transition-shadow"
          >
            <div>
              {/* Card Image Banner */}
              <div className="h-40 relative overflow-hidden bg-slate-900">
                <img
                  src={path.bgImage}
                  alt={path.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                    {path.category}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="text-sm font-extrabold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                    {path.title}
                  </h4>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                  {path.badgeText || 'OFFICIAL CURRICULUM'}
                </span>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {path.description}
                </p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 pt-0">
              <button
                type="button"
                onClick={() => startEdit(path)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Edit Card</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reset Confirmation */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset Exam Category Cards?"
        message="Are you sure you want to reset all 4 exam category cards and hero images back to the system defaults? Custom titles and images will be replaced."
        confirmLabel="Reset to Defaults"
        cancelLabel="Cancel"
        isDanger={false}
        onConfirm={() => {
          onResetDefaults();
          setShowResetModal(false);
          showToast('Reset homepage exam path cards to default.', 'info');
        }}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
