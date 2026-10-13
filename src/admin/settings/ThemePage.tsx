import React, { useState, useCallback } from "react";
import { Palette, RotateCcw, Save, CheckCircle2, Loader2, Zap, Eye } from "lucide-react";
import { useTheme, ThemeConfig, DEFAULT_THEME } from "../../context/ThemeContext";

// ─── Preset Palettes ──────────────────────────────────────────────────────────

const PRESETS: { label: string; primary: string; bg: string }[] = [
  { label: "Emerald (Default)", primary: "#00875a", bg: "#f8fafc" },
  { label: "Ocean Blue",        primary: "#0070f3", bg: "#f0f6ff" },
  { label: "Royal Purple",      primary: "#7c3aed", bg: "#faf5ff" },
  { label: "Crimson Red",       primary: "#dc2626", bg: "#fff5f5" },
  { label: "Amber Gold",        primary: "#d97706", bg: "#fffbeb" },
  { label: "Rose Pink",         primary: "#e11d48", bg: "#fff1f2" },
  { label: "Teal",              primary: "#0891b2", bg: "#f0fdfe" },
  { label: "Slate Dark",        primary: "#334155", bg: "#f1f5f9" },
  { label: "Indigo",            primary: "#4f46e5", bg: "#eef2ff" },
  { label: "Forest Green",      primary: "#15803d", bg: "#f0fdf4" },
];

// ─── Swatch ───────────────────────────────────────────────────────────────────

const Swatch: React.FC<{
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}> = ({ color, label, selected, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    className={`w-8 h-8 rounded-xl border-2 transition-all cursor-pointer hover:scale-110 ${
      selected ? "border-slate-900 scale-110 shadow-md" : "border-transparent hover:border-slate-300"
    }`}
    style={{ backgroundColor: color }}
  />
);

// ─── LivePreview ──────────────────────────────────────────────────────────────

const LivePreview: React.FC<{ primary: string; bg: string }> = ({ primary, bg }) => {
  // Darken primary for hover simulation
  const darken = (hex: string, a = 18) => {
    const c = hex.replace("#", "");
    const n = parseInt(c, 16);
    const r = Math.max(0, (n >> 16) - a);
    const g = Math.max(0, ((n >> 8) & 0xff) - a);
    const b = Math.max(0, (n & 0xff) - a);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const dark = darken(primary, 20);

  return (
    <div
      className="rounded-2xl border border-slate-200 p-4 space-y-3 transition-all duration-300"
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Eye className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Preview</span>
      </div>

      {/* Simulated product card */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: primary + "20" }}>
            <div className="w-full h-full rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: primary }} />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">IELTS Band 8 Guide</div>
            <div className="text-[10px]" style={{ color: primary }}>IELTS · Study Guide</div>
          </div>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex gap-2">
          <button
            className="flex-1 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all"
            style={{ backgroundColor: primary }}
          >
            Buy Now
          </button>
          <button
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
            style={{ borderColor: primary, color: primary }}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Simulated nav link */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primary }} />
        <span className="text-[11px] font-semibold" style={{ color: primary }}>View all IELTS products →</span>
      </div>

      {/* Simulated badge */}
      <div
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
        style={{ backgroundColor: primary + "15", color: primary }}
      >
        <Zap className="w-3 h-3" />
        Best Seller
      </div>
    </div>
  );
};

// ─── Main ThemePage ───────────────────────────────────────────────────────────

interface ThemePageProps {
  showToast: (message: string, type?: "success" | "info" | "warning") => void;
}

export const ThemePage: React.FC<ThemePageProps> = ({ showToast }) => {
  const { theme, setTheme, saveTheme, resetTheme, isSaving } = useTheme();

  // Local draft — applied live to DOM via setTheme, saved on Save button
  const [draft, setDraft] = useState<ThemeConfig>({ ...theme });
  const [justSaved, setJustSaved] = useState(false);

  const applyDraft = useCallback((next: ThemeConfig) => {
    setDraft(next);
    setTheme(next); // immediate live preview
  }, [setTheme]);

  const handleSave = async () => {
    await saveTheme(draft);
    setJustSaved(true);
    showToast("Theme saved and synced across all tabs!", "success");
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleReset = () => {
    const def = { ...DEFAULT_THEME };
    setDraft(def);
    resetTheme();
    showToast("Theme reset to default emerald palette", "info");
  };

  const isDirty =
    draft.primaryColor !== theme.primaryColor || draft.pageBgColor !== theme.pageBgColor;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-600" />
            Theme &amp; Brand Colours
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Changes apply live across the entire storefront instantly — no rebuild required.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl transition-all cursor-pointer disabled:opacity-60 shadow-sm"
            style={{ backgroundColor: draft.primaryColor }}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : justSaved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? "Saving..." : justSaved ? "Saved!" : "Save & Sync"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-7 space-y-5">

          {/* Preset Palettes */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Preset Palettes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyDraft({ primaryColor: p.primary, pageBgColor: p.bg })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                    draft.primaryColor === p.primary && draft.pageBgColor === p.bg
                      ? "border-slate-400 bg-slate-50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-5 h-5 rounded-md border border-white/50 shadow-xs" style={{ backgroundColor: p.primary }} />
                    <div className="w-5 h-5 rounded-md border border-slate-200" style={{ backgroundColor: p.bg }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 truncate">{p.label}</span>
                  {draft.primaryColor === p.primary && draft.pageBgColor === p.bg && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colour Pickers */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Custom Colours
            </h3>

            {/* Primary Button / Brand Color */}
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 block">Primary / Button Colour</label>
                  <p className="text-[11px] text-slate-400">Used on all CTA buttons, links, badges, and accents</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.primaryColor}
                    onChange={(e) => applyDraft({ ...draft, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5"
                    title="Pick primary color"
                  />
                  <input
                    type="text"
                    value={draft.primaryColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) applyDraft({ ...draft, primaryColor: v });
                    }}
                    maxLength={7}
                    className="w-24 px-2 py-1.5 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-center uppercase"
                    placeholder="#00875a"
                  />
                </div>
              </div>

              {/* Quick Swatches: Primary */}
              <div className="flex flex-wrap gap-2">
                {["#00875a","#0070f3","#7c3aed","#dc2626","#d97706","#e11d48","#0891b2","#334155","#4f46e5","#15803d","#f59e0b","#ec4899","#06b6d4","#8b5cf6","#10b981","#ef4444"].map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    label={c}
                    selected={draft.primaryColor.toLowerCase() === c.toLowerCase()}
                    onClick={() => applyDraft({ ...draft, primaryColor: c })}
                  />
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Page Background Color */}
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 block">Page Background Colour</label>
                  <p className="text-[11px] text-slate-400">Applied to the entire storefront body background</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.pageBgColor}
                    onChange={(e) => applyDraft({ ...draft, pageBgColor: e.target.value })}
                    className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5"
                    title="Pick background color"
                  />
                  <input
                    type="text"
                    value={draft.pageBgColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) applyDraft({ ...draft, pageBgColor: v });
                    }}
                    maxLength={7}
                    className="w-24 px-2 py-1.5 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-center uppercase"
                    placeholder="#f8fafc"
                  />
                </div>
              </div>

              {/* Quick Swatches: Background */}
              <div className="flex flex-wrap gap-2">
                {["#ffffff","#f8fafc","#f0f6ff","#faf5ff","#fff5f5","#fffbeb","#f0fdfe","#f1f5f9","#fdf2f8","#f0fdf4","#fefce8","#ecfdf5"].map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    label={c}
                    selected={draft.pageBgColor.toLowerCase() === c.toLowerCase()}
                    onClick={() => applyDraft({ ...draft, pageBgColor: c })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sync status banner */}
          <div className="flex items-center gap-3 p-3.5 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900">Live sync enabled</p>
              <p className="text-[11px] text-blue-600">
                Changes preview instantly. "Save &amp; Sync" persists to Cloudflare KV and all open browser tabs.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3 sticky top-6">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Storefront Preview
            </h3>
            <LivePreview primary={draft.primaryColor} bg={draft.pageBgColor} />

            <div className="pt-1 grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md border border-slate-200 shrink-0" style={{ backgroundColor: draft.primaryColor }} />
                  <span className="font-mono text-slate-700">{draft.primaryColor.toUpperCase()}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Background</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md border border-slate-200 shrink-0" style={{ backgroundColor: draft.pageBgColor }} />
                  <span className="font-mono text-slate-700">{draft.pageBgColor.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {isDirty && !justSaved && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold pt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes — click "Save &amp; Sync" to apply globally
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
