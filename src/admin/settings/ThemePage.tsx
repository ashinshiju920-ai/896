import React, { useState, useCallback } from "react";
import { Palette, RotateCcw, Save, CheckCircle2, Loader2, Zap, Eye, Undo2 } from "lucide-react";
import { useTheme, ThemeConfig, DEFAULT_THEME } from "../../context/ThemeContext";

// ─── Preset Palettes ──────────────────────────────────────────────────────────

const PRESETS: Array<{ label: string; theme: ThemeConfig }> = [
  { label: "Emerald Default", theme: DEFAULT_THEME },
  {
    label: "Ocean Blue",
    theme: { ...DEFAULT_THEME, primaryColor: "#0070f3", secondaryColor: "#082f49", pageBgColor: "#f0f6ff", footerBgColor: "#082f49", textColor: "#0f2747" },
  },
  {
    label: "Royal Purple",
    theme: { ...DEFAULT_THEME, primaryColor: "#7c3aed", secondaryColor: "#2e1065", pageBgColor: "#faf5ff", footerBgColor: "#24104f", textColor: "#2e1065" },
  },
  {
    label: "Crimson",
    theme: { ...DEFAULT_THEME, primaryColor: "#dc2626", secondaryColor: "#3f1111", pageBgColor: "#fff5f5", footerBgColor: "#3f1111", textColor: "#391515" },
  },
  {
    label: "Amber Gold",
    theme: { ...DEFAULT_THEME, primaryColor: "#d97706", secondaryColor: "#2f2411", pageBgColor: "#fffbeb", footerBgColor: "#2f2411", textColor: "#2f2411" },
  },
  {
    label: "Slate Premium",
    theme: { ...DEFAULT_THEME, primaryColor: "#334155", secondaryColor: "#0f172a", pageBgColor: "#f1f5f9", footerBgColor: "#0f172a", textColor: "#0f172a" },
  },
];

const THEME_HISTORY_LIMIT = 30;

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

const ColorControl: React.FC<{
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, description, value, onChange }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <label className="text-xs font-bold text-slate-800 block">{label}</label>
      <p className="text-[11px] text-slate-400">{description}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5"
        title={`Pick ${label}`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
        }}
        maxLength={7}
        className="w-24 px-2 py-1.5 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-center uppercase"
      />
    </div>
  </div>
);

const LivePreview: React.FC<{ theme: ThemeConfig }> = ({ theme }) => {
  const { primaryColor, pageBgColor, cardBgColor, headerBgColor, footerBgColor, textColor, buttonTextColor } = theme;

  return (
    <div
      className="rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300"
      style={{ backgroundColor: pageBgColor }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200" style={{ backgroundColor: headerBgColor }}>
        <span className="text-xs font-black" style={{ color: textColor }}>Aylem Store</span>
        <span className="text-[10px] font-bold" style={{ color: primaryColor }}>Books</span>
      </div>

      <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Eye className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Preview</span>
      </div>

      {/* Simulated product card */}
      <div className="rounded-xl border border-slate-100 p-3 space-y-2 shadow-xs" style={{ backgroundColor: cardBgColor }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: primaryColor + "20" }}>
            <div className="w-full h-full rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: textColor }}>IELTS Band 8 Guide</div>
            <div className="text-[10px]" style={{ color: primaryColor }}>IELTS Study Guide</div>
          </div>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex gap-2">
          <button
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{ backgroundColor: primaryColor, color: buttonTextColor }}
          >
            Buy Now
          </button>
          <button
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Simulated nav link */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
        <span className="text-[11px] font-semibold" style={{ color: primaryColor }}>View all IELTS products</span>
      </div>

      {/* Simulated badge */}
      <div
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
        style={{ backgroundColor: primaryColor + "15", color: primaryColor }}
      >
        <Zap className="w-3 h-3" />
        Best Seller
      </div>
      </div>

      <div className="px-4 py-3 text-[10px] font-bold" style={{ backgroundColor: footerBgColor, color: buttonTextColor }}>
        Footer and dark sections use this colour
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
  const [history, setHistory] = useState<ThemeConfig[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  const applyDraft = useCallback((next: ThemeConfig, options: { remember?: boolean } = {}) => {
    const { remember = true } = options;
    if (remember && JSON.stringify(next) !== JSON.stringify(draft)) {
      setHistory((prev) => [...prev.slice(-(THEME_HISTORY_LIMIT - 1)), draft]);
    }
    setDraft(next);
    setTheme(next); // immediate live preview
  }, [draft, setTheme]);

  const handleUndo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    applyDraft(previous, { remember: false });
    showToast("Theme change undone", "info");
  };

  const handleSave = async () => {
    await saveTheme(draft);
    setHistory([]);
    setJustSaved(true);
    showToast("Theme saved and synced across all tabs!", "success");
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleReset = () => {
    const def = { ...DEFAULT_THEME };
    setHistory((prev) => [...prev.slice(-(THEME_HISTORY_LIMIT - 1)), draft]);
    setDraft(def);
    resetTheme();
    showToast("Theme reset to default emerald palette", "info");
  };

  const isDirty = Object.keys(DEFAULT_THEME).some((key) => (
    draft[key as keyof ThemeConfig] !== theme[key as keyof ThemeConfig]
  ));

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
            onClick={handleUndo}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            title="Undo last theme colour change"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
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
                  onClick={() => applyDraft({ ...p.theme })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                    draft.primaryColor === p.theme.primaryColor && draft.pageBgColor === p.theme.pageBgColor
                      ? "border-slate-400 bg-slate-50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-5 h-5 rounded-md border border-white/50 shadow-xs" style={{ backgroundColor: p.theme.primaryColor }} />
                    <div className="w-5 h-5 rounded-md border border-white/50 shadow-xs" style={{ backgroundColor: p.theme.secondaryColor }} />
                    <div className="w-5 h-5 rounded-md border border-slate-200" style={{ backgroundColor: p.theme.pageBgColor }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 truncate">{p.label}</span>
                  {draft.primaryColor === p.theme.primaryColor && draft.pageBgColor === p.theme.pageBgColor && (
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

            <div className="space-y-3">
              <ColorControl
                label="Primary / Button Colour"
                description="Buy Now, checkout buttons, active links, badges, and accents"
                value={draft.primaryColor}
                onChange={(primaryColor) => applyDraft({ ...draft, primaryColor })}
              />

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

            <div className="space-y-3">
              <ColorControl
                label="Page Background Colour"
                description="Overall storefront background behind sections and product grids"
                value={draft.pageBgColor}
                onChange={(pageBgColor) => applyDraft({ ...draft, pageBgColor })}
              />

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

            <div className="h-px bg-slate-100" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <ColorControl
                label="Secondary / Dark Colour"
                description="Hero overlays, secondary buttons, and dark sections"
                value={draft.secondaryColor}
                onChange={(secondaryColor) => applyDraft({ ...draft, secondaryColor })}
              />
              <ColorControl
                label="Button Text Colour"
                description="Text shown on primary filled buttons"
                value={draft.buttonTextColor}
                onChange={(buttonTextColor) => applyDraft({ ...draft, buttonTextColor })}
              />
              <ColorControl
                label="Card Colour"
                description="Product cards and light content panels"
                value={draft.cardBgColor}
                onChange={(cardBgColor) => applyDraft({ ...draft, cardBgColor })}
              />
              <ColorControl
                label="Header Colour"
                description="Storefront navigation header background"
                value={draft.headerBgColor}
                onChange={(headerBgColor) => applyDraft({ ...draft, headerBgColor })}
              />
              <ColorControl
                label="Footer Colour"
                description="Storefront footer background"
                value={draft.footerBgColor}
                onChange={(footerBgColor) => applyDraft({ ...draft, footerBgColor })}
              />
              <ColorControl
                label="Main Text Colour"
                description="Headings and important dark text"
                value={draft.textColor}
                onChange={(textColor) => applyDraft({ ...draft, textColor })}
              />
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
            <LivePreview theme={draft} />

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
