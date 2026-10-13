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
  primaryColor: string;   // e.g. "#00875a"
  pageBgColor: string;    // e.g. "#f8fafc"
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
  pageBgColor: "#f8fafc",
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

/** Inject (or update) the single dynamic override <style> tag in <head> */
function applyThemeToDom(theme: ThemeConfig) {
  const { primaryColor, pageBgColor } = theme;
  const dark = darkenHex(primaryColor, 20);
  const darker = darkenHex(primaryColor, 30);
  const shadow = hexWithAlpha(primaryColor, 0.32);
  const shadowLight = hexWithAlpha(primaryColor, 0.2);

  // Escape for CSS attribute selector
  const esc = (c: string) => c.replace("#", "\\#").replace("(", "\\(").replace(")", "\\)");
  const primary = esc(primaryColor);
  const darkHex = esc(dark);

  const css = `
:root {
  --brand-primary: ${primaryColor};
  --brand-primary-dark: ${dark};
  --brand-primary-darker: ${darker};
  --page-bg: ${pageBgColor};
}

/* Page background */
body { background-color: ${pageBgColor} !important; }

/* ── Tailwind arbitrary-value overrides ───────────────────────────────── */
/* bg-[#00875a]  → brand primary */
[class*="bg-[${primary}]"]           { background-color: ${primaryColor} !important; }
[class*="hover\\:bg-[${primary}]"]:hover { background-color: ${primaryColor} !important; }

/* bg-[#00734c] / bg-[#006e49] (hover darks) → brand dark */
[class*="bg-[${darkHex}]"]           { background-color: ${dark} !important; }
[class*="hover\\:bg-[${darkHex}]"]:hover { background-color: ${dark} !important; }
[class*="bg-[\\#006e49]"]            { background-color: ${dark} !important; }
[class*="hover\\:bg-[\\#006e49]"]:hover { background-color: ${dark} !important; }

/* text-[#00875a] → brand primary text */
[class*="text-[${primary}]"]         { color: ${primaryColor} !important; }
[class*="hover\\:text-[${primary}]"]:hover { color: ${primaryColor} !important; }

/* from-[#00875a] gradient stops */
[class*="from-[${primary}]"]         { --tw-gradient-from: ${primaryColor} !important; }
[class*="via-[${primary}]"]          { --tw-gradient-via: ${primaryColor} !important; }
[class*="to-[${primary}]"]           { --tw-gradient-to: ${primaryColor} !important; }

/* border-[#00875a] */
[class*="border-[${primary}]"]       { border-color: ${primaryColor} !important; }

/* outline (focus ring) */
[class*="outline-[\\#00704a]"]       { outline-color: ${dark} !important; }
[class*="focus\\:border-emerald"]    { /* keep tailwind emerald, intentional */ }

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
[class*="hover\\:bg-[${darkHex}]"]:hover,
[class*="hover\\:bg-[${primary}]"]:hover {
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
  root.style.setProperty("--page-bg", pageBgColor);
}

// ─── Load from localStorage ───────────────────────────────────────────────────

function loadStoredTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.primaryColor === "string") {
        return { ...DEFAULT_THEME, ...parsed };
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

  // Set up BroadcastChannel listener for cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel(BC_CHANNEL);
    bcRef.current = bc;
    bc.onmessage = (e) => {
      if (e.data?.type === "THEME_UPDATED" && e.data.theme) {
        const incoming: ThemeConfig = e.data.theme;
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
            _setTheme(parsed);
            applyThemeToDom(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Live-preview: apply immediately to DOM without persisting */
  const setTheme = useCallback((t: ThemeConfig) => {
    _setTheme(t);
    applyThemeToDom(t);
  }, []);

  /** Persist to localStorage + BroadcastChannel + Cloudflare KV */
  const saveTheme = useCallback(async (t: ThemeConfig) => {
    _setTheme(t);
    applyThemeToDom(t);

    // 1. localStorage
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(t));
    } catch {}

    // 2. BroadcastChannel (instant cross-tab)
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({ type: "THEME_UPDATED", theme: t });
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
              themeConfig: t,
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
