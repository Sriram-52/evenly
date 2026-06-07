import { createContext, useContext } from "react";

// Scheme-independent brand + semantic colors.
const STATIC = {
  brand: "#5B5BD6",
  brandDeep: "#4338CA",
  accent: "#EC4899",
  textOnBrand: "#FFFFFF",
  danger: "#E5484D",
  success: "#30A46C",
};

// Scheme-dependent colors. Kept as plain values (no DynamicColorIOS) so they
// work identically on iOS and Android and can be overridden by a user-chosen
// theme, not just the system one.
const PALETTES = {
  light: {
    text: "#15151B",
    textMuted: "#6B6B7B",
    // Fallback surfaces (non-Liquid-Glass platforms) + input fills.
    surface: "rgba(255,255,255,0.72)",
    surfaceBorder: "rgba(255,255,255,0.6)",
    hairline: "rgba(20,20,30,0.08)",
    inputBg: "rgba(255,255,255,0.6)",
    // Opaque background for sheets/menus (action sheet).
    sheet: "#FFFFFF",
  },
  dark: {
    text: "#F4F4F8",
    textMuted: "#9C9CAB",
    surface: "rgba(60,60,74,0.55)",
    surfaceBorder: "rgba(255,255,255,0.14)",
    hairline: "rgba(255,255,255,0.14)",
    inputBg: "rgba(255,255,255,0.08)",
    sheet: "#1C1C28",
  },
};

export type ColorScheme = "light" | "dark";
export type ThemeColors = typeof STATIC & (typeof PALETTES)["light"];

export function colorsFor(scheme: ColorScheme): ThemeColors {
  return { ...STATIC, ...PALETTES[scheme] };
}

// User's theme preference. "automatic" follows the system scheme.
export type ThemeMode = "automatic" | "light" | "dark";

export type ThemeContextValue = {
  colors: ThemeColors;
  scheme: ColorScheme; // effective (resolved) scheme
  mode: ThemeMode; // user preference
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  colors: colorsFor("light"),
  scheme: "light",
  mode: "automatic",
  setMode: () => {},
});

// Colors for the current theme — re-renders the component when the theme changes.
export function useColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

// Full theme state (effective scheme + the preference + a setter).
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Background gradient stops + wash opacities per scheme (used by ScreenBackground).
export const backdrop = {
  light: {
    stops: ["#EEF1FF", "#F6EDFF", "#FFF1F6"] as const,
    washBrand: 0.14,
    washAccent: 0.1,
  },
  dark: {
    stops: ["#0D0D14", "#13101E", "#190F1A"] as const,
    washBrand: 0.26,
    washAccent: 0.2,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

// Format integer cents as "$d.dd" — the ONLY place cents become a float.
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// First + last initial (e.g. "Jane Doe" → "JD"), so similar first names don't
// collide on the avatar chips. Single-word names use their first two letters.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Parse a user-typed dollar string ("12.99", "$3", "1,200.5") to integer cents.
export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return 0;
  return Math.round(dollars * 100);
}
