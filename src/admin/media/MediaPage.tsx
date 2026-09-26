import React, { useState } from 'react';
import {
  Upload,
  Copy,
  CheckCircle2,
  ImageIcon,
  Loader2,
  ExternalLink,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { Book, Testimonial, ExamPath } from '../../types';
import { uploadImageToCloud } from '../../utils/cloudSync';

interface MediaPageProps {
  books: Book[];
  testimonials: Testimonial[];
  examPaths: ExamPath[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const MediaPage: React.FC<MediaPageProps> = ({
  books,
  testimonials,
  examPaths,
  showToast,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [latestUploadedUrl, setLatestUploadedUrl] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds maximum permitted limit of 5 MB', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImageToCloud(file, 'media_library');
      setLatestUploadedUrl(url);
      showToast('Media uploaded to Cloudinary CDN successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Media upload failed', 'warning');
    } finally {
      setIsUploading(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('Image URL copied to clipboard!', 'success');
  };

  // Collect all unique images referenced across active catalog
  const referencedImages: Array<{ url: string; source: string }> = [];
  const seen = new Set<string>();

  books.forEach((b) => {
    if (b.imageUrl && !seen.has(b.imageUrl)) {
      seen.add(b.imageUrl);
      referencedImages.push({ url: b.imageUrl, source: `Book: ${b.title}` });
    }
    (b.images || []).forEach((img) => {
      if (img && !seen.has(img)) {
        seen.add(img);
        referencedImages.push({ url: img, source: `Book: ${b.title}` });
      }
    });
  });

  examPaths.forEach((p) => {
    if (p.bgImage && !seen.has(p.bgImage)) {
      seen.add(p.bgImage);
      referencedImages.push({ url: p.bgImage, source: `Category: ${p.category}` });
    }
  });

  testimonials.forEach((t) => {
    if (t.avatar && !seen.has(t.avatar)) {
      seen.add(t.avatar);
      referencedImages.push({ url: t.avatar, source: `Student: ${t.name}` });
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
          Media & Asset Library
        </h2>
        <p className="text-xs text-slate-500">
          Upload and manage genuine images backed by Cloudinary CDN storage with magic bytes validation.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-8 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
          Upload Media Asset to Cloudinary
        </h3>

        <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20 flex flex-col items-center justify-center space-y-3 block">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              {isUploading ? 'Validating and uploading binary to Cloudinary...' : 'Click to select or drop an image file here'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Supports genuine JPEG, PNG, or WebP up to 5 MB (Strict binary magic bytes verified)
            </p>
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>

        {/* Latest Uploaded Result Banner */}
        {latestUploadedUrl && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={latestUploadedUrl}
                alt="Uploaded"
                className="w-12 h-12 rounded-xl object-cover border border-emerald-300 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Upload Ready
                </span>
                <span className="text-xs font-mono text-slate-700 truncate block">
                  {latestUploadedUrl}
                </span>
              </div>
            </div>

            <button
              onClick={() => copyUrl(latestUploadedUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy URL</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Catalog Images Gallery */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Referenced Catalog Assets
            </h3>
            <p className="text-xs text-slate-500">Images actively linked to books, hero cards, and testimonials</p>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {referencedImages.length} Assets
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {referencedImages.map((item, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col justify-between group"
            >
              <div className="h-28 bg-white relative overflow-hidden flex items-center justify-center">
                <img
                  src={item.url}
                  alt={item.source}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="p-2.5 space-y-1">
                <p className="text-[10px] text-slate-500 truncate" title={item.source}>
                  {item.source}
                </p>
                <button
                  type="button"
                  onClick={() => copyUrl(item.url)}
                  className="w-full py-1 text-[10px] font-semibold text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
