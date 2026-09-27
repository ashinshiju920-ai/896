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
  ChevronUp,
  ChevronDown,
  Check,
  Sparkles,
  DownloadCloud,
  BookOpen,
  Copy,
  History,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Book, ExamCategory, ProductAddon, DigitalFileVersion } from '../../types';
import { uploadImageToCloud } from '../../utils/cloudSync';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ProductPurchasePreview } from '../../components/ProductPurchasePreview';

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

  const initialAddonsRaw = (Array.isArray(initialBook?.addOns) && initialBook.addOns.length > 0)
    ? initialBook.addOns
    : ((Array.isArray(initialBook?.addons) && initialBook.addons.length > 0) ? initialBook.addons : []);

  const normalizedInitialAddons: ProductAddon[] = initialAddonsRaw.length > 0
    ? initialAddonsRaw.map((a) => {
        const rawId = a.id || `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const normId = rawId === 'addon_digital' ? 'digital' : (rawId === 'addon_physical' ? 'physical' : rawId);
        const priceRupees = Number(a.price) || (a.pricePaise ? Math.round(Number(a.pricePaise) / 100) : 0);
        const pricePaise = a.pricePaise !== undefined ? Number(a.pricePaise) : priceRupees * 100;
        return {
          ...a,
          id: normId,
          name: a.name || '',
          description: a.description || a.subtitle || '',
          subtitle: a.subtitle || a.description || '',
          price: priceRupees,
          pricePaise: pricePaise,
          originalPrice: Number(a.originalPrice) || priceRupees,
          active: a.active !== false,
          deliveryOption: a.deliveryOption || (normId === 'physical' ? 'physical' : 'digital'),
          digitalFile: a.digitalFile || (a.pdfUrl ? {
            filename: a.samplePdfName || `${normId}.pdf`,
            fileUrl: a.pdfUrl,
            mimeType: 'application/pdf',
          } : undefined),
          pdfUrl: a.pdfUrl || a.digitalFile?.fileUrl || '',
          samplePdfName: a.samplePdfName || a.digitalFile?.filename || '',
        };
      })
    : [
        {
          id: 'digital',
          name: 'Digital (PDF)',
          subtitle: 'Instant Download',
          description: 'Instant Download',
          price: initialBook?.prices?.digital?.price ?? 199,
          pricePaise: (initialBook?.prices?.digital?.price ?? 199) * 100,
          originalPrice: initialBook?.prices?.digital?.originalPrice ?? 599,
          active: true,
          deliveryOption: 'digital',
        },
        {
          id: 'physical',
          name: 'Physical (Printed)',
          subtitle: 'Delivered in 3-5 days',
          description: 'Delivered in 3-5 days',
          price: initialBook?.prices?.physical?.price ?? 899,
          pricePaise: (initialBook?.prices?.physical?.price ?? 899) * 100,
          originalPrice: initialBook?.prices?.physical?.originalPrice ?? 1499,
          active: true,
          deliveryOption: 'physical',
        },
      ];

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
    addons: normalizedInitialAddons,
    addOns: normalizedInitialAddons,
    buy2Get3rdFree: Boolean(initialBook?.buy2Get3rdFree),
    addonDealText: initialBook?.addonDealText || 'Special Deal: Buy Any 2 Add-ons, Get the 3rd FREE!',
  };

  const [form, setForm] = useState<Omit<Book, 'id'>>(defaultFormData);
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'media' | 'digital' | 'curriculum' | 'addons' | 'display' | 'preview'>('general');
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

  // Phase 9 Digital Material Versioning State
  const [productVersions, setProductVersions] = useState<DigitalFileVersion[]>([]);
  const [addonVersionsMap, setAddonVersionsMap] = useState<Record<string, DigitalFileVersion[]>>({});
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isReplacingFile, setIsReplacingFile] = useState(false);
  const [replaceTargetAddonIdx, setReplaceTargetAddonIdx] = useState<number | null>(null);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceVersionLabel, setReplaceVersionLabel] = useState('');
  const [replaceReleaseNotes, setReplaceReleaseNotes] = useState('');
  const [selectedReplaceFile, setSelectedReplaceFile] = useState<File | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalTarget, setHistoryModalTarget] = useState<{ title: string; versions: DigitalFileVersion[] }>({ title: '', versions: [] });
  const [showInlineHistory, setShowInlineHistory] = useState(true);

  // Fetch product versions on mount or book change
  React.useEffect(() => {
    if (initialBook?.id) {
      fetchProductVersions();
    }
  }, [initialBook?.id]);

  const fetchProductVersions = async () => {
    if (!initialBook?.id) return;
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/admin/materials?productId=${encodeURIComponent(initialBook.id)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.versions)) {
          setProductVersions(data.versions);
        }
      }
    } catch (err) {
      console.warn('Could not fetch material versions:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const fetchAddonVersions = async (addonId: string) => {
    if (!initialBook?.id || !addonId) return [];
    try {
      const res = await fetch(`/api/admin/materials?productId=${encodeURIComponent(initialBook.id)}&addOnId=${encodeURIComponent(addonId)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.versions)) {
          setAddonVersionsMap((prev) => ({ ...prev, [addonId]: data.versions }));
          return data.versions;
        }
      }
    } catch (err) {
      console.warn(`Could not fetch versions for addon ${addonId}:`, err);
    }
    return [];
  };

  const openReplaceModal = (addonIndex: number | null = null) => {
    setReplaceTargetAddonIdx(addonIndex);
    setSelectedReplaceFile(null);
    setReplaceReleaseNotes('');

    if (addonIndex === null) {
      const currVer = form.digitalFile?.version || '2026.1';
      const parts = currVer.split('.');
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        setReplaceVersionLabel(`${parts[0]}.${Number(parts[1]) + 1}`);
      } else {
        setReplaceVersionLabel(`${currVer}.1`);
      }
    } else {
      const targetAddon = (form.addOns || form.addons || [])[addonIndex];
      const currVer = targetAddon?.digitalFile?.version || '1.0';
      const parts = currVer.split('.');
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        setReplaceVersionLabel(`${parts[0]}.${Number(parts[1]) + 1}`);
      } else {
        setReplaceVersionLabel(`${currVer}.1`);
      }
    }
    setReplaceModalOpen(true);
  };

  const handleOpenAddonHistory = async (index: number) => {
    const targetAddon = (form.addOns || form.addons || [])[index];
    const addonId = targetAddon.id || targetAddon.addOnId || '';
    if (!addonId) return;
    let vers = addonVersionsMap[addonId];
    if (!vers) {
      vers = await fetchAddonVersions(addonId);
    }
    setHistoryModalTarget({
      title: `${targetAddon.name || 'Add-on'} — Version History`,
      versions: vers || [],
    });
    setShowHistoryModal(true);
  };

  const handleExecuteReplace = async () => {
    if (!selectedReplaceFile) {
      showToast('Please select a genuine PDF document', 'warning');
      return;
    }
    if (selectedReplaceFile.size > 50 * 1024 * 1024) {
      showToast('File size exceeds maximum permitted limit of 50 MB', 'warning');
      return;
    }

    setIsReplacingFile(true);
    try {
      const prodId = initialBook?.id || form.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const isAddon = replaceTargetAddonIdx !== null;
      const targetAddon = isAddon ? (form.addOns || form.addons || [])[replaceTargetAddonIdx] : null;
      const addOnId = targetAddon ? (targetAddon.id || targetAddon.addOnId) : null;

      const formData = new FormData();
      formData.append('file', selectedReplaceFile);
      formData.append('productId', prodId);
      if (addOnId) formData.append('addOnId', addOnId);
      if (replaceVersionLabel.trim()) formData.append('versionLabel', replaceVersionLabel.trim());
      if (replaceReleaseNotes.trim()) formData.append('releaseNotes', replaceReleaseNotes.trim());

      const res = await fetch('/api/admin/materials', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'File replacement failed');
      }

      if (!isAddon) {
        setForm((prev) => ({
          ...prev,
          samplePdfName: data.version.fileName,
          pdfUrl: data.version.storageReference || prev.pdfUrl,
          digitalFile: {
            ...prev.digitalFile,
            fileVersionId: data.version.id,
            version: data.version.versionLabel,
            filename: data.version.fileName,
            samplePdfName: data.version.fileName,
            fileUrl: data.version.storageReference || prev.digitalFile?.fileUrl,
            pdfUrl: data.version.storageReference || prev.digitalFile?.pdfUrl,
            fileSizeBytes: data.version.sizeBytes,
            checksum: data.version.checksum,
            releaseNotes: data.version.releaseNotes,
            status: 'ACTIVE',
            createdAt: data.version.createdAt,
          },
        }));
        await fetchProductVersions();
      } else {
        const currentAddons = [...(form.addOns || form.addons || [])];
        if (replaceTargetAddonIdx !== null && currentAddons[replaceTargetAddonIdx]) {
          currentAddons[replaceTargetAddonIdx] = {
            ...currentAddons[replaceTargetAddonIdx],
            samplePdfName: data.version.fileName,
            pdfUrl: data.version.storageReference || currentAddons[replaceTargetAddonIdx].pdfUrl,
            digitalFile: {
              ...currentAddons[replaceTargetAddonIdx].digitalFile,
              fileVersionId: data.version.id,
              version: data.version.versionLabel,
              filename: data.version.fileName,
              samplePdfName: data.version.fileName,
              fileUrl: data.version.storageReference || currentAddons[replaceTargetAddonIdx].digitalFile?.fileUrl,
              pdfUrl: data.version.storageReference || currentAddons[replaceTargetAddonIdx].digitalFile?.pdfUrl,
              fileSizeBytes: data.version.sizeBytes,
              checksum: data.version.checksum,
              releaseNotes: data.version.releaseNotes,
              status: 'ACTIVE',
              createdAt: data.version.createdAt,
            },
          };
          updateAddons(currentAddons);
          if (addOnId) await fetchAddonVersions(addOnId);
        }
      }

      setIsDirty(true);
      setReplaceModalOpen(false);
      setSelectedReplaceFile(null);
      setReplaceVersionLabel('');
      setReplaceReleaseNotes('');
      showToast(`Material updated to ${data.version.versionLabel} (ACTIVE). Previous version archived.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'File replacement failed', 'warning');
    } finally {
      setIsReplacingFile(false);
    }
  };

  const updateField = <K extends keyof Omit<Book, 'id'>>(key: K, val: Omit<Book, 'id'>[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const updateAddons = (newAddons: ProductAddon[]) => {
    setForm((prev) => ({
      ...prev,
      addons: newAddons,
      addOns: newAddons,
    }));
    setIsDirty(true);
  };

  const handleAddAddon = () => {
    const newId = `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newAddon: ProductAddon = {
      id: newId,
      name: '',
      description: '',
      subtitle: '',
      price: 99,
      pricePaise: 9900,
      originalPrice: 199,
      active: true,
      deliveryOption: 'digital',
      digitalFile: undefined,
    };
    const current = form.addOns || form.addons || [];
    updateAddons([...current, newAddon]);
    showToast('New add-on added. Configure details below.', 'info');
  };

  const handleDuplicateAddon = (index: number) => {
    const current = [...(form.addOns || form.addons || [])];
    const source = current[index];
    if (!source) return;
    const newId = `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duplicated: ProductAddon = {
      ...source,
      id: newId,
      name: `${source.name || 'Add-on'} (Copy)`,
    };
    current.splice(index + 1, 0, duplicated);
    updateAddons(current);
    showToast('Add-on duplicated with unique ID.', 'info');
  };

  const handleRemoveAddon = (index: number) => {
    const current = [...(form.addOns || form.addons || [])];
    const removed = current.splice(index, 1);
    updateAddons(current);
    showToast(`Add-on "${removed[0]?.name || 'Item'}" removed`, 'info');
  };

  const handleMoveAddon = (index: number, direction: 'up' | 'down') => {
    const current = [...(form.addOns || form.addons || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[index];
    current[index] = current[targetIdx];
    current[targetIdx] = temp;
    updateAddons(current);
  };

  const handleToggleActive = (index: number) => {
    const current = [...(form.addOns || form.addons || [])];
    current[index] = {
      ...current[index],
      active: current[index].active === false ? true : false,
    };
    updateAddons(current);
  };

  const handleAddonFieldChange = <K extends keyof ProductAddon>(index: number, field: K, value: ProductAddon[K]) => {
    const current = [...(form.addOns || form.addons || [])];
    current[index] = {
      ...current[index],
      [field]: value,
    };
    if (field === 'price') {
      const p = Math.max(0, Math.min(100000, Number(value) || 0));
      current[index].price = p;
      current[index].pricePaise = Math.round(p * 100);
    }
    updateAddons(current);
  };

  const handleAddonFileUpload = (index: number, file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      showToast('Add-on file exceeds 25 MB limit', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const current = [...(form.addOns || form.addons || [])];
      current[index] = {
        ...current[index],
        digitalFile: {
          filename: file.name,
          fileUrl: base64,
          fileSizeBytes: file.size,
          mimeType: 'application/pdf',
        },
        pdfUrl: base64,
        samplePdfName: file.name,
      };
      updateAddons(current);
      showToast(`PDF "${file.name}" attached to add-on!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleAddonFileRemove = (index: number) => {
    const current = [...(form.addOns || form.addons || [])];
    current[index] = {
      ...current[index],
      digitalFile: undefined,
      pdfUrl: '',
      samplePdfName: '',
    };
    updateAddons(current);
    showToast('Digital file detached from add-on', 'info');
  };

  const handleAddonStorageUrlChange = (index: number, url: string) => {
    const current = [...(form.addOns || form.addons || [])];
    const currentFile = current[index].digitalFile;
    current[index] = {
      ...current[index],
      digitalFile: url.trim() ? {
        filename: currentFile?.filename || `${current[index].name || 'addon'}.pdf`,
        fileUrl: url.trim(),
        mimeType: 'application/pdf',
      } : undefined,
      pdfUrl: url.trim(),
      samplePdfName: currentFile?.filename || `${current[index].name || 'addon'}.pdf`,
    };
    updateAddons(current);
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

    // Validate add-ons
    const addonsList = form.addOns || form.addons || [];
    const seenIds = new Set<string>();
    const sanitizedAddons: ProductAddon[] = [];

    for (let i = 0; i < addonsList.length; i++) {
      const a = addonsList[i];
      let id = a.id ? a.id.trim() : `addon_${Date.now()}_${i}`;
      if (seenIds.has(id)) {
        id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
      }
      seenIds.add(id);

      const price = Number(a.price);
      if (isNaN(price) || !isFinite(price) || price < 0) {
        showToast(`Invalid price for add-on "${a.name || `Add-on #${i + 1}`}". Price must be non-negative.`, 'warning');
        setActiveTab('addons');
        return;
      }

      sanitizedAddons.push({
        ...a,
        id,
        name: (a.name || '').trim().slice(0, 120),
        description: (a.description || a.subtitle || '').trim().slice(0, 500),
        subtitle: (a.subtitle || a.description || '').trim().slice(0, 150),
        price: Math.floor(price),
        pricePaise: a.pricePaise !== undefined ? a.pricePaise : Math.round(price * 100),
        originalPrice: Number(a.originalPrice) || Math.floor(price),
        active: a.active !== false,
        deliveryOption: a.deliveryOption || 'digital',
      });
    }

    const submissionPayload: Omit<Book, 'id'> = {
      ...form,
      addons: sanitizedAddons,
      addOns: sanitizedAddons,
    };

    setIsSaving(true);
    try {
      onSave(submissionPayload, initialBook?.id);
      setIsDirty(false);
      showToast(isEditing ? 'Product updated successfully!' : 'New product published to catalog!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'warning');
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
          {/* Mobile Customer Preview Toggle */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'preview' ? 'addons' : 'preview')}
            className="xl:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>{activeTab === 'preview' ? 'Back to Editor' : 'Customer Preview'}</span>
          </button>

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
          { id: 'addons', label: '6. Optional Add-ons' },
          { id: 'display', label: '7. Marketing & Flags' },
          { id: 'preview', label: '8. Customer Preview', className: 'xl:hidden' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } ${tab.className || ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Grid: Form on Left (xl:col-span-7), Sticky Live Customer Preview on Right (xl:col-span-5) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <div className={`space-y-6 ${activeTab === 'preview' ? 'hidden xl:block xl:col-span-7' : 'xl:col-span-7'}`}>
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
                          const currentAddons = prev.addOns || prev.addons || [];
                          const updatedAddons = currentAddons.map((a) =>
                            a.id === 'digital' || a.deliveryOption === 'digital'
                              ? { ...a, price, pricePaise: price * 100, originalPrice: orig }
                              : a
                          );
                          return {
                            ...prev,
                            prices: {
                              ...prev.prices,
                              digital: { price, originalPrice: orig, discountPercent: discount },
                            },
                            addons: updatedAddons,
                            addOns: updatedAddons,
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
                          const currentAddons = prev.addOns || prev.addons || [];
                          const updatedAddons = currentAddons.map((a) =>
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
                            addOns: updatedAddons,
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
                          const currentAddons = prev.addOns || prev.addons || [];
                          const updatedAddons = currentAddons.map((a) =>
                            a.id === 'physical' || a.deliveryOption === 'physical'
                              ? { ...a, price, pricePaise: price * 100, originalPrice: orig }
                              : a
                          );
                          return {
                            ...prev,
                            prices: {
                              ...prev.prices,
                              physical: { price, originalPrice: orig, discountPercent: discount },
                            },
                            addons: updatedAddons,
                            addOns: updatedAddons,
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
                          const currentAddons = prev.addOns || prev.addons || [];
                          const updatedAddons = currentAddons.map((a) =>
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
                            addOns: updatedAddons,
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
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Protected Digital Product Security (Step 3 & Phase 9 Verified)</span>
              </div>
              <p>
                PDF assets configured here are strictly gatekept behind the server-authoritative <code>/api/download</code> endpoint.
                Public visitors cannot view or scrape this asset without a verified PAID order.
                Replacing files automatically preserves customer lifetime access and historical purchase prices.
              </p>
            </div>

            {/* DIGITAL MATERIAL - Current File & Version Card */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 tracking-wider uppercase">DIGITAL MATERIAL</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {form.digitalFile?.status || 'ACTIVE'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openReplaceModal(null)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Replace File</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current File</div>
                  <div className="text-xs font-bold text-slate-900 truncate font-mono">
                    {form.digitalFile?.filename || form.samplePdfName || 'No file attached'}
                  </div>
                  {form.digitalFile?.fileSizeBytes ? (
                    <div className="text-[10px] text-slate-400 font-mono">
                      {(form.digitalFile.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Version</div>
                  <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>{form.digitalFile?.version || '2026.1'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {form.digitalFile?.checksum ? `SHA256: ${form.digitalFile.checksum.slice(0, 12)}...` : 'Lifetime active grant'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</div>
                  <div className="text-xs font-semibold text-emerald-700">
                    {form.digitalFile?.status || 'ACTIVE'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {form.digitalFile?.releaseNotes ? `Note: "${form.digitalFile.releaseNotes}"` : 'Current authorized release'}
                  </div>
                </div>
              </div>
            </div>

            {/* VERSION HISTORY */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800 tracking-wider uppercase">VERSION HISTORY</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchProductVersions}
                    disabled={isLoadingVersions}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    title="Refresh version history"
                  >
                    <Clock className={`w-3.5 h-3.5 ${isLoadingVersions ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInlineHistory(!showInlineHistory)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    {showInlineHistory ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              {showInlineHistory && (
                <div className="space-y-2 pt-1">
                  {isLoadingVersions ? (
                    <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span>Loading stored version history...</span>
                    </div>
                  ) : productVersions.length === 0 ? (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{form.digitalFile?.version || '2026.1'}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">ACTIVE</span>
                        <span className="text-slate-400 truncate max-w-[200px]">{form.digitalFile?.filename || form.samplePdfName}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Current initial release</span>
                    </div>
                  ) : (
                    productVersions.map((v) => (
                      <div
                        key={v.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          v.status === 'ACTIVE'
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                            : 'bg-white border-slate-200 text-slate-700 opacity-80'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold">{v.versionLabel}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                v.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {v.status}
                            </span>
                            <span className="font-mono text-slate-600 truncate max-w-[250px]">{v.fileName}</span>
                            {v.sizeBytes > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({(v.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                              </span>
                            )}
                          </div>
                          {v.releaseNotes && (
                            <p className="text-[11px] text-slate-500 italic pl-1">"{v.releaseNotes}"</p>
                          )}
                        </div>

                        <div className="text-right text-[11px] text-slate-400 shrink-0 font-medium">
                          {new Date(v.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Direct/Manual Configuration (Advanced) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Direct / Upstream Link Configuration (Fallback)
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Sample / Download Filename Override
                </label>
                <input
                  type="text"
                  value={form.samplePdfName}
                  onChange={(e) => updateField('samplePdfName', e.target.value)}
                  placeholder="Xylem-IELTS-Full-Preparation-Guide.pdf"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Protected Cloud Storage / Upstream URL
                </label>
                <input
                  type="url"
                  value={form.pdfUrl?.startsWith('data:') ? '' : form.pdfUrl}
                  onChange={(e) => updateField('pdfUrl', e.target.value)}
                  placeholder="https://storage.xylemlearning.com/secure/ielts-guide.pdf"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                />
              </div>
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

        {/* TAB 6: OPTIONAL ADD-ONS */}
        {activeTab === 'addons' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header info banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 border border-emerald-200/80 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-extrabold text-[#0a2540] uppercase tracking-wider">
                    Optional Add-ons
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Offer additional study materials that customers can purchase with this product.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddAddon}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Add Another Add-on</span>
              </button>
            </div>

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

            {/* Add-ons List */}
            <div className="space-y-4">
              {(!form.addOns || form.addOns.length === 0) ? (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center mx-auto text-slate-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      No Add-ons Configured
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Click below to create your first add-on module (e.g. Mock Test Pack, Vocabulary Booster, or Audio Drills).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAddon}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Add-on</span>
                  </button>
                </div>
              ) : (
                (form.addOns || []).map((addon, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === (form.addOns?.length || 0) - 1;
                  const isActive = addon.active !== false;

                  return (
                    <div
                      key={addon.id || idx}
                      className={`p-5 rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-white border-slate-200/90 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-300/80 opacity-80'
                      }`}
                    >
                      {/* Card Header & Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <h4 className="text-xs font-extrabold text-[#0a2540] truncate max-w-xs">
                            {addon.name || 'Untitled Add-on'}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {addon.id}
                          </span>
                        </div>

                        {/* Control buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Active / Inactive Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(idx)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Toggle whether customers can view and select this add-on"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            <span>{isActive ? 'Active [ ON ]' : 'Inactive [ OFF ]'}</span>
                          </button>

                          {/* Reorder: Move Up */}
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveAddon(idx, 'up')}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>

                          {/* Reorder: Move Down */}
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveAddon(idx, 'down')}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateAddon(idx)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Duplicate Add-on"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemoveAddon(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Add-on"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Add-on Form Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        {/* Name */}
                        <div className="space-y-1 sm:col-span-8">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Add-on Name *
                          </label>
                          <input
                            type="text"
                            maxLength={120}
                            value={addon.name}
                            onChange={(e) => handleAddonFieldChange(idx, 'name', e.target.value)}
                            placeholder="e.g. 10 Full-Length IELTS Mock Tests Pack"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Format */}
                        <div className="space-y-1 sm:col-span-4">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Format / Delivery
                          </label>
                          <select
                            value={addon.deliveryOption || 'digital'}
                            onChange={(e) => handleAddonFieldChange(idx, 'deliveryOption', e.target.value as any)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                          >
                            <option value="digital">Digital (Instant Download)</option>
                            <option value="physical">Physical (Printed Material)</option>
                          </select>
                        </div>

                        {/* Description */}
                        <div className="space-y-1 sm:col-span-12">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Description
                            </label>
                            <span className="text-[10px] text-slate-400">
                              {(addon.description || '').length}/500
                            </span>
                          </div>
                          <textarea
                            rows={2}
                            maxLength={500}
                            value={addon.description || ''}
                            onChange={(e) => handleAddonFieldChange(idx, 'description', e.target.value)}
                            placeholder="e.g. Timed authentic exam papers with full solution keys and band 8+ model answers."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white resize-none"
                          />
                        </div>

                        {/* Selling Price */}
                        <div className="space-y-1 sm:col-span-6">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Price (₹) *
                            </label>
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {addon.pricePaise || (addon.price || 0) * 100} paise
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              max="100000"
                              value={addon.price}
                              onChange={(e) => handleAddonFieldChange(idx, 'price', Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                            />
                          </div>
                        </div>

                        {/* Original Price */}
                        <div className="space-y-1 sm:col-span-6">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Original Price (₹) (Optional strikethrough)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              max="100000"
                              value={addon.originalPrice || ''}
                              onChange={(e) => handleAddonFieldChange(idx, 'originalPrice', Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="e.g. 199"
                              className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-600"
                            />
                          </div>
                        </div>

                        {/* Digital Material Attachment (Section 10 & 11) */}
                        {addon.deliveryOption !== 'physical' && (
                          <div className="space-y-2 sm:col-span-12 pt-2 border-t border-slate-100">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Digital Material / Asset (.pdf)
                            </label>

                            {addon.digitalFile?.filename || addon.pdfUrl ? (
                              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h5 className="text-xs font-bold text-emerald-950 truncate max-w-[220px]">
                                        {addon.digitalFile?.filename || addon.samplePdfName || 'Attached Document.pdf'}
                                      </h5>
                                      <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                        v{addon.digitalFile?.version || '1.0'}
                                      </span>
                                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">
                                        {addon.digitalFile?.status || 'ACTIVE'}
                                      </span>
                                      {addon.digitalFile?.fileSizeBytes && (
                                        <span className="text-[9px] text-slate-500 font-mono">
                                          {(addon.digitalFile.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-emerald-700 mt-0.5 truncate">
                                      {addon.digitalFile?.releaseNotes ? `Note: "${addon.digitalFile.releaseNotes}"` : 'Protected study asset for verified purchasers'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => openReplaceModal(idx)}
                                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  >
                                    <Upload className="w-3 h-3 text-slate-500" />
                                    <span>Replace File</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddonHistory(idx)}
                                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                    title="View version history"
                                  >
                                    <History className="w-3 h-3 text-slate-500" />
                                    <span>History</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddonFileRemove(idx)}
                                    className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <h5 className="text-xs font-semibold text-slate-700">
                                    No Digital File Attached
                                  </h5>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Attach a PDF study resource to be automatically unlocked when this add-on is purchased.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => openReplaceModal(idx)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-colors cursor-pointer shrink-0"
                                >
                                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Upload Digital Material</span>
                                </button>
                              </div>
                            )}

                            {/* Optional Storage URL input */}
                            <div className="pt-1">
                              <input
                                type="url"
                                value={addon.pdfUrl?.startsWith('data:') ? '' : (addon.pdfUrl || '')}
                                onChange={(e) => handleAddonStorageUrlChange(idx, e.target.value)}
                                placeholder="Or enter protected storage URL (e.g. https://storage.xylemlearning.com/...)"
                                className="w-full px-3 py-1.5 text-[11px] rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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
    </div>

    {/* Right Column: Live Customer Preview (visible side-by-side on xl: screens, or full-width on mobile when activeTab === 'preview') */}
    <div className={`space-y-4 ${activeTab === 'preview' ? 'block' : 'hidden xl:block'} xl:col-span-5`}>
      <div className="xl:sticky xl:top-6">
        <ProductPurchasePreview book={form as any} />
      </div>
    </div>
  </div>

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

      {/* PHASE 9: SAFE FILE REPLACEMENT MODAL */}
      {replaceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Safe Digital Material Replacement
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {replaceTargetAddonIdx === null
                      ? `Product: ${form.title || 'Main Material'}`
                      : `Add-on: ${(form.addOns || form.addons || [])[replaceTargetAddonIdx]?.name || 'Add-on Material'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplaceModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Entitlement & Order Continuity Guaranteed</span>
                </div>
                <p className="text-emerald-800">
                  Activating a new PDF version preserves customer lifetime access and historical purchase records.
                  The previous version is safely archived. If replacement fails, the old version remains valid.
                </p>
              </div>

              {/* 1. File Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Select Replacement PDF Document (.pdf) *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedReplaceFile(file);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                </div>
                {selectedReplaceFile && (
                  <div className="text-[11px] text-slate-600 flex items-center gap-2 pt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-mono">{selectedReplaceFile.name}</span>
                    <span className="text-slate-400">({(selectedReplaceFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>

              {/* 2. Version Label */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Version Label (Human-readable)
                </label>
                <input
                  type="text"
                  value={replaceVersionLabel}
                  onChange={(e) => setReplaceVersionLabel(e.target.value)}
                  placeholder="e.g. 2026.2, 2.0, or September 2026"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                />
              </div>

              {/* 3. Release Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Release Notes / Change Description (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={replaceReleaseNotes}
                  onChange={(e) => setReplaceReleaseNotes(e.target.value)}
                  placeholder="e.g. Updated speaking practice section and corrected answer keys."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplaceModalOpen(false)}
                disabled={isReplacingFile}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReplace}
                disabled={!selectedReplaceFile || isReplacingFile}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isReplacingFile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating & Activating...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Activate New Version</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 9: VERSION HISTORY MODAL (For Add-ons & General) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {historyModalTarget.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
              {historyModalTarget.versions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No historical versions found. The current file is the initial authorized release.
                </div>
              ) : (
                historyModalTarget.versions.map((v) => (
                  <div
                    key={v.id}
                    className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      v.status === 'ACTIVE'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-700 opacity-80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold">{v.versionLabel}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            v.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {v.status}
                        </span>
                        <span className="font-mono text-slate-600 truncate max-w-[220px]">{v.fileName}</span>
                        {v.sizeBytes > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({(v.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        )}
                      </div>
                      {v.releaseNotes && (
                        <p className="text-[11px] text-slate-500 italic pl-1">"{v.releaseNotes}"</p>
                      )}
                    </div>

                    <div className="text-right text-[11px] text-slate-400 shrink-0 font-medium">
                      {new Date(v.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
