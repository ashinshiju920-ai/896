/**
 * ThemeContext — Global brand colour theming system.
 *
 * Strategy: inject one dynamic <style> tag that overrides all Tailwind
 * arbitrary-value classes site-wide, using CSS custom properties.
 * Zero component changes needed — works entirely via the cascade.
 *
 * Sync strategy:
 *   1. localStorage  — instant on load, zero latency
 *   2. BroadcastChannel — zero-lag cross-tab (same as catalog sync)
 *   3. Cloudflare KV  — piggybacked on existing /api/products endpoint
 *                        via the `themeConfig` field
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  primaryColor: string;      // Main CTA buttons, links, active states
  secondaryColor: string;    // Dark hero/accent surfaces
  pageBgColor: string;       // Storefront page background
  cardBgColor: string;       // Product cards and light panels
  headerBgColor: string;     // Storefront header
  footerBgColor: string;     // Storefront footer
  textColor: string;         // Main headings/body emphasis
  buttonTextColor: string;   // Text on primary buttons
}

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
  saveTheme: (t: ThemeConfig) => Promise<void>;
  resetTheme: () => void;
  isSaving: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#00875a",
  secondaryColor: "#0a2540",
  pageBgColor: "#f8fafc",
  cardBgColor: "#ffffff",
  headerBgColor: "#ffffff",
  footerBgColor: "#0b1f33",
  textColor: "#0a2540",
  buttonTextColor: "#ffffff",
};

const LS_KEY = "xylem_theme_config";
const BC_CHANNEL = "xylem_theme_sync";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Darken a hex colour by `amount` (0–255) */
function darkenHex(hex: string, amount = 18): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Build hex with 0-100 opacity for shadow colors */
function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function normalizeTheme(input: Partial<ThemeConfig> | null | undefined): ThemeConfig {
  return { ...DEFAULT_THEME, ...(input || {}) };
}

/** Inject (or update) the single dynamic override <style> tag in <head> */
function applyThemeToDom(theme: ThemeConfig) {
  const {
    primaryColor,
    secondaryColor,
    pageBgColor,
    cardBgColor,
    headerBgColor,
    footerBgColor,
    textColor,
    buttonTextColor,
  } = normalizeTheme(theme);
  const dark = darkenHex(primaryColor, 20);
  const darker = darkenHex(primaryColor, 30);
  const secondaryDark = darkenHex(secondaryColor, 16);
  const shadow = hexWithAlpha(primaryColor, 0.32);
  const shadowLight = hexWithAlpha(primaryColor, 0.2);
  const primarySoft = hexWithAlpha(primaryColor, 0.12);
  const primarySofter = hexWithAlpha(primaryColor, 0.07);
  const primaryBorder = hexWithAlpha(primaryColor, 0.28);

  const css = `
:root {
  --brand-primary: ${primaryColor};
  --brand-primary-dark: ${dark};
  --brand-primary-darker: ${darker};
  --brand-secondary: ${secondaryColor};
  --brand-secondary-dark: ${secondaryDark};
  --page-bg: ${pageBgColor};
  --card-bg: ${cardBgColor};
  --header-bg: ${headerBgColor};
  --footer-bg: ${footerBgColor};
  --theme-text: ${textColor};
  --button-text: ${buttonTextColor};
}

/* Page background */
body { background-color: ${pageBgColor} !important; }
[data-storefront="true"] { background-color: ${pageBgColor} !important; color: ${textColor}; }

/* Primary storefront controls: buttons, links, active states, badges */
[class*="bg-[\\#00875a]"],
.bg-emerald-600,
.bg-emerald-500,
.bg-emerald-400 {
  background-color: ${primaryColor} !important;
  color: ${buttonTextColor} !important;
}

[class*="hover\\:bg-[\\#00875a]"]:hover,
[class*="hover\\:bg-[\\#00734c]"]:hover,
[class*="bg-[\\#00734c]"],
[class*="bg-[\\#006e49]"],
.hover\\:bg-emerald-700:hover,
.hover\\:bg-emerald-600:hover,
.hover\\:bg-emerald-500:hover {
  background-color: ${dark} !important;
  color: ${buttonTextColor} !important;
}

.text-emerald-950,
.text-emerald-900,
.text-emerald-800,
.text-emerald-700,
.text-emerald-600,
.text-emerald-500,
.text-emerald-400,
[class*="text-[\\#00875a]"] {
  color: ${primaryColor} !important;
}

.hover\\:text-emerald-700:hover,
.hover\\:text-emerald-400:hover,
[class*="hover\\:text-[\\#00875a]"]:hover {
  color: ${primaryColor} !important;
}

.border-emerald-800,
.border-emerald-600,
.border-emerald-500,
.border-emerald-400,
.border-emerald-300,
.border-emerald-200,
.border-emerald-100,
[class*="border-[\\#00875a]"] {
  border-color: ${primaryBorder} !important;
}

.bg-emerald-950,
.bg-emerald-100,
.bg-emerald-50,
[class*="bg-emerald-100"],
[class*="bg-emerald-50"] {
  background-color: ${primarySoft} !important;
}

[class*="ring-emerald"],
[class*="focus\\:ring-emerald"],
[class*="focus-visible\\:ring-emerald"] {
  --tw-ring-color: ${primaryBorder} !important;
}

[class*="focus\\:border-emerald"] {
  border-color: ${primaryColor} !important;
}

.from-emerald-600,
.from-emerald-50,
[class*="from-[\\#00875a]"] {
  --tw-gradient-from: ${primaryColor} var(--tw-gradient-from-position) !important;
  --tw-gradient-to: ${hexWithAlpha(primaryColor, 0)} var(--tw-gradient-to-position) !important;
}

.via-emerald-50,
[class*="via-[\\#00875a]"] {
  --tw-gradient-via: ${primarySofter} var(--tw-gradient-via-position) !important;
}

.to-emerald-50,
[class*="to-[\\#00875a]"] {
  --tw-gradient-to: ${primarySofter} var(--tw-gradient-to-position) !important;
}

/* Secondary/dark brand surfaces */
[class*="bg-[\\#0a2540]"],
[class*="bg-[\\#0b1f33]"] {
  background-color: ${secondaryColor} !important;
}

[class*="hover\\:bg-[\\#081d33]"]:hover {
  background-color: ${secondaryDark} !important;
}

[class*="text-[\\#0a2540]"],
[class*="text-[\\#0b1f33]"] {
  color: ${textColor} !important;
}

/* Storefront header/footer and cards */
header,
header[class*="bg-white"] {
  background-color: ${headerBgColor} !important;
}

footer {
  background-color: ${footerBgColor} !important;
}

[data-storefront="true"] main .bg-white,
[data-storefront="true"] main [class*="bg-[#ffffff]"] {
  background-color: ${cardBgColor} !important;
}

/* outline (focus ring) */
[class*="outline-[\\#00704a]"]       { outline-color: ${dark} !important; }

/* CSS keyframe shadow colors in index.css */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 ${hexWithAlpha(primaryColor, 0.4)}, 0 10px 25px -5px ${hexWithAlpha(primaryColor, 0.3)};
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 12px ${hexWithAlpha(primaryColor, 0)}, 0 14px 28px -5px ${hexWithAlpha(primaryColor, 0.45)};
    transform: scale(1.01);
  }
}

/* hover box-shadow with brand color */
[class*="hover\\:bg-[\\#00875a]"]:hover,
[class*="hover\\:bg-[\\#00734c]"]:hover,
.hover\\:bg-emerald-700:hover,
.hover\\:bg-emerald-600:hover,
.hover\\:bg-emerald-500:hover {
  box-shadow: 0 8px 18px -3px ${shadow}, 0 3px 6px -2px ${shadowLight};
}

/* proceed-to-payment focus ring */
#proceed-to-payment-btn:focus-visible {
  outline-color: ${dark} !important;
}

/* Loading bar gradient */
.progressive-loader-bar {
  background: linear-gradient(90deg, ${primaryColor}, ${darkenHex(primaryColor, -20)}, #8ff5df) !important;
}
`;

  let styleEl = document.getElementById("xylem-theme-overrides");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "xylem-theme-overrides";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;

  // Also set CSS variables on root for any component using var()
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", primaryColor);
  root.style.setProperty("--brand-primary-dark", dark);
  root.style.setProperty("--brand-secondary", secondaryColor);
  root.style.setProperty("--brand-secondary-dark", secondaryDark);
  root.style.setProperty("--page-bg", pageBgColor);
  root.style.setProperty("--card-bg", cardBgColor);
  root.style.setProperty("--header-bg", headerBgColor);
  root.style.setProperty("--footer-bg", footerBgColor);
  root.style.setProperty("--theme-text", textColor);
  root.style.setProperty("--button-text", buttonTextColor);
}

// ─── Load from localStorage ───────────────────────────────────────────────────

function loadStoredTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.primaryColor === "string") {
        return normalizeTheme(parsed);
      }
    }
  } catch {}
  return { ...DEFAULT_THEME };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, _setTheme] = useState<ThemeConfig>(loadStoredTheme);
  const [isSaving, setIsSaving] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);

  // Apply on first render
  useEffect(() => {
    applyThemeToDom(theme);
  }, []);

  // Pull saved cloud theme when available. localStorage still wins instantly first,
  // then the remote value reconciles across devices without blocking paint.
  useEffect(() => {
    let cancelled = false;

    async function loadCloudTheme() {
      try {
        const res = await fetch(`/api/products?_t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.themeConfig?.primaryColor || cancelled) return;

        const incoming = normalizeTheme(data.themeConfig);
        _setTheme(incoming);
        applyThemeToDom(incoming);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(incoming));
        } catch {}
      } catch {
        // Cloud theme is optional; keep local/default theme if unavailable.
      }
    }

    loadCloudTheme();
    return () => {
      cancelled = true;
    };
  }, []);

  // Set up BroadcastChannel listener for cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel(BC_CHANNEL);
    bcRef.current = bc;
    bc.onmessage = (e) => {
      if (e.data?.type === "THEME_UPDATED" && e.data.theme) {
        const incoming: ThemeConfig = normalizeTheme(e.data.theme);
        _setTheme(incoming);
        applyThemeToDom(incoming);
      }
    };
    return () => bc.close();
  }, []);

  // localStorage storage event (other tabs)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.primaryColor) {
            const incoming = normalizeTheme(parsed);
            _setTheme(incoming);
            applyThemeToDom(incoming);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Live-preview: apply immediately to DOM without persisting */
  const setTheme = useCallback((t: ThemeConfig) => {
    const next = normalizeTheme(t);
    _setTheme(next);
    applyThemeToDom(next);
  }, []);

  /** Persist to localStorage + BroadcastChannel + Cloudflare KV */
  const saveTheme = useCallback(async (t: ThemeConfig) => {
    const next = normalizeTheme(t);
    _setTheme(next);
    applyThemeToDom(next);

    // 1. localStorage
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}

    // 2. BroadcastChannel (instant cross-tab)
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({ type: "THEME_UPDATED", theme: next });
      } catch {}
    }

    // 3. Cloud sync — piggyback on existing catalog endpoint
    setIsSaving(true);
    try {
      // Fetch current catalog so we don"t overwrite it
      const res = await fetch(`/api/products?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.books)) {
          // Push catalog + theme together
          await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              books: data.books,
              examPaths: data.examPaths,
              testimonials: data.testimonials,
              catalogBanner: data.catalogBanner,
              homeSpotlight: data.homeSpotlight,
              themeConfig: next,
            }),
          });
        }
      }
    } catch (e) {
      console.warn("Theme cloud sync failed:", e);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resetTheme = useCallback(() => {
    setTheme({ ...DEFAULT_THEME });
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, saveTheme, resetTheme, isSaving }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
