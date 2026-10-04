import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  Star,
  Upload,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Testimonial } from '../../types';
import { uploadImageToCloud } from '../../utils/cloudSync';
import { ConfirmationModal } from '../components/ConfirmationModal';

const AVATAR_PRESETS = [
  { label: 'Professional Woman (Anjana)', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80' },
  { label: 'Doctor / Nurse (Rohith)', url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&auto=format&fit=crop&q=80' },
  { label: 'Young Professional (Sneha)', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80' },
  { label: 'Confident Scholar', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { label: 'International Student', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
];

interface TestimonialsPageProps {
  testimonials: Testimonial[];
  onAddTestimonial: (t: Omit<Testimonial, 'id'>) => boolean | Promise<boolean>;
  onUpdateTestimonial: (id: string, updated: Partial<Testimonial>) => boolean | Promise<boolean>;
  onDeleteTestimonial: (id: string) => boolean | Promise<boolean>;
  onResetDefaults: () => boolean | Promise<boolean>;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const TestimonialsPage: React.FC<TestimonialsPageProps> = ({
  testimonials,
  onAddTestimonial,
  onUpdateTestimonial,
  onDeleteTestimonial,
  onResetDefaults,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [quote, setQuote] = useState('');
  const [rating, setRating] = useState(5);
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0].url);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [testimonialToDelete, setTestimonialToDelete] = useState<Testimonial | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const uploadedUrl = await uploadImageToCloud(file, 'testimonial');
      setAvatarUrl(uploadedUrl);
      showToast('Avatar photo uploaded to Cloudinary!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Avatar upload failed', 'warning');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quote.trim()) {
      showToast('Name and testimonial quote are required', 'warning');
      return;
    }

    let saved = false;
    if (editingId) {
      saved = await onUpdateTestimonial(editingId, {
        name: name.trim(),
        role: role.trim() || 'Verified Learner',
        quote: quote.trim(),
        rating,
        avatar: avatarUrl,
      });
    } else {
      saved = await onAddTestimonial({
        name: name.trim(),
        role: role.trim() || 'Verified Learner',
        quote: quote.trim(),
        rating,
        avatar: avatarUrl,
      });
    }

    if (!saved) return;
    setEditingId(null);
    setName('');
    setRole('');
    setQuote('');
    setRating(5);
    setAvatarUrl(AVATAR_PRESETS[0].url);
  };

  const handleEdit = (t: Testimonial) => {
    setEditingId(t.id);
    setName(t.name);
    setRole(t.role);
    setQuote(t.quote);
    setRating(t.rating);
    setAvatarUrl(t.avatar);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setRole('');
    setQuote('');
    setRating(5);
    setAvatarUrl(AVATAR_PRESETS[0].url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            Homepage Student Testimonials
          </h2>
          <p className="text-xs text-slate-500">
            Manage the student endorsements and score achievements showcased on the homepage.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Add/Edit Testimonial */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4 h-fit">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">Student Name *</label>
              <input
                type="text"
                placeholder="e.g. Anjana Mohan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">Role / Achievement</label>
              <input
                type="text"
                placeholder="e.g. IELTS Band 8.5 • UK Registered Nurse"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Avatar Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-700 block">Student Photo / Avatar</label>
              <div className="flex items-center gap-3">
                <img
                  src={avatarUrl}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                />
                <div className="flex-1 space-y-1">
                  <select
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                  >
                    {AVATAR_PRESETS.map((p, idx) => (
                      <option key={idx} value={p.url}>
                        Preset: {p.label}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>{isUploadingAvatar ? 'Uploading...' : 'Or Upload Photo to Cloudinary'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">Quote / Feedback *</label>
              <textarea
                rows={3}
                placeholder="The practice mock tests and band 8 templates were crucial to my first-attempt success..."
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingId ? 'Save Testimonial' : 'Publish Testimonial'}</span>
            </button>
          </form>
        </div>

        {/* Right List: Testimonials */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Active Homepage Testimonials
            </h3>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
              {testimonials.length} Displayed
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {testimonials.map((t) => (
              <div key={t.id} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                      <div className="flex text-amber-500">
                        {Array.from({ length: t.rating || 5 }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold text-emerald-800">{t.role}</p>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{t.quote}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(t)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTestimonialToDelete(t)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Testimonial Modal */}
      <ConfirmationModal
        isOpen={Boolean(testimonialToDelete)}
        title="Delete Testimonial?"
        message={`Are you sure you want to remove ${testimonialToDelete?.name}'s testimonial from the homepage?`}
        confirmLabel="Yes, Delete"
        cancelLabel="Keep"
        isDanger={true}
        onConfirm={async () => {
          if (testimonialToDelete) {
            const deleted = await onDeleteTestimonial(testimonialToDelete.id);
            if (deleted) setTestimonialToDelete(null);
          }
        }}
        onCancel={() => setTestimonialToDelete(null)}
      />

      {/* Reset Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset All Testimonials?"
        message="Are you sure you want to reset homepage testimonials to the default editorial set? Custom testimonials will be replaced."
        confirmLabel="Reset to Defaults"
        cancelLabel="Cancel"
        isDanger={false}
        onConfirm={async () => {
          const reset = await onResetDefaults();
          if (reset) setShowResetModal(false);
        }}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
