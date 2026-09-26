import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  ShieldCheck,
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Server,
  Lock,
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface SettingsPageProps {
  isCloudSyncing: boolean;
  lastCloudSync: Date | null;
  onRefreshCloud: () => Promise<void>;
  onSyncToCloud: () => Promise<void>;
  onResetCatalog: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  isCloudSyncing,
  lastCloudSync,
  onRefreshCloud,
  onSyncToCloud,
  onResetCatalog,
  showToast,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncToCloud();
      showToast('Catalog saved & synced to Cloudflare KV and Cloudinary!', 'success');
    } catch {
      showToast('Could not sync to cloud', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      await onRefreshCloud();
      showToast('Catalog refreshed from Cloudflare Edge!', 'success');
    } catch {
      showToast('Could not refresh catalog', 'warning');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
          System Infrastructure & Cloud Settings
        </h2>
        <p className="text-xs text-slate-500">
          Monitor Cloudflare Edge functions, database bindings, media synchronization, and security controls.
        </p>
      </div>

      {/* Cloud Sync Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Edge Catalog Synchronization
              </h3>
              <p className="text-xs text-slate-500">
                Authoritative Cloudflare KV (PRODUCTS_KV) & Cloudinary Raw CDN fallback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isCloudSyncing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span>Pull Latest</span>
            </button>
            <button
              onClick={handleManualSync}
              disabled={isSyncing || isCloudSyncing}
              className="px-4 py-2 bg-[#00875a] hover:bg-[#00734c] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Push Live</span>
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Sync Mode</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Real-time Broadcast</span>
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Successful Sync</span>
            <span className="font-semibold text-slate-900 mt-0.5 block">
              {lastCloudSync ? lastCloudSync.toLocaleString() : 'Ready at Edge'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Version Protocol</span>
            <span className="font-mono text-slate-700 mt-0.5 block">
              KV Unix Epoch Timestamp
            </span>
          </div>
        </div>
      </div>

      {/* Backend Infrastructure Overview */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
          Connected Cloudflare & Payment Services
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Service 1: Cloudflare KV */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <Database className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                Active
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Cloudflare KV</h4>
            <p className="text-[11px] text-slate-500">
              Binding: <code>PRODUCTS_KV</code>. Caches product catalog, order mapping, and rate limits.
            </p>
          </div>

          {/* Service 2: Cloudflare D1 */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <Server className="w-5 h-5 text-blue-600" />
              <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                Active
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Cloudflare D1</h4>
            <p className="text-[11px] text-slate-500">
              Binding: <code>DB</code>. Stores order tables, integer paise records, and audit events.
            </p>
          </div>

          {/* Service 3: Cloudinary CDN */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <Cloud className="w-5 h-5 text-purple-600" />
              <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                Active
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Cloudinary CDN</h4>
            <p className="text-[11px] text-slate-500">
              Stores product book covers, avatars, and persistent catalog backups.
            </p>
          </div>

          {/* Service 4: Cashfree Payments */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                Verified
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Cashfree PG v3</h4>
            <p className="text-[11px] text-slate-500">
              Webhooks protected with HMAC-SHA256 signature verification & replay defense.
            </p>
          </div>
        </div>
      </div>

      {/* Security Architecture Summary */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Active Edge Security Parameters
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600 pt-1">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="font-bold text-slate-900 block">Password Hashing:</span>
            <span>PBKDF2 (SHA-256, 100k iter)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="font-bold text-slate-900 block">Session Validation:</span>
            <span>HMAC-SHA256 Token</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="font-bold text-slate-900 block">Rate Limiting:</span>
            <span>KV Sliding Window (30/min)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="font-bold text-slate-900 block">CORS & CSP:</span>
            <span>Strict Origin Whitelist</span>
          </div>
        </div>
      </div>

      {/* Danger Zone: Reset Catalog */}
      <div className="bg-rose-50/60 rounded-3xl border border-rose-200/80 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-rose-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Reset Product Catalog to Defaults
          </h3>
          <p className="text-xs text-rose-700 mt-1">
            Restores all 9 original curriculum study guides (IELTS, OET, PTE, German) back to their editorial baseline.
            Any custom products added or custom prices modified will be restored.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Catalog to Factory Defaults</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset Entire Product Catalog?"
        message="Are you sure you want to reset all products back to the system defaults? Custom titles, prices, and attached materials will be replaced."
        confirmLabel="Reset Catalog"
        cancelLabel="Cancel"
        isDanger={true}
        onConfirm={() => {
          onResetCatalog();
          setShowResetModal(false);
          showToast('Catalog restored to default books & synced across all clients', 'info');
        }}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
