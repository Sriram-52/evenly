import { Appearance, DynamicColorIOS, Platform } from "react-native";

// iOS dynamic color resolves light/dark live at render time. Android has no
// equivalent for plain JS colors, so we resolve once at startup from the system
// scheme. (A theme switch needs an app restart on Android; the gradient backdrop
// uses useColorScheme so it updates live regardless — acceptable for now.)
const androidDark = Appearance.getColorScheme() === "dark";
const dyn = (light: string, dark: string) =>
  Platform.OS === "ios"
    ? DynamicColorIOS({ light, dark })
    : androidDark
      ? dark
      : light;

export const colors = {
  // Brand reads well on both schemes, so it stays static.
  brand: "#5B5BD6",
  brandDeep: "#4338CA",
  accent: "#EC4899",

  text: dyn("#15151B", "#F4F4F8"),
  textMuted: dyn("#6B6B7B", "#9C9CAB"),
  textOnBrand: "#FFFFFF",

  // Fallback surfaces (non-Liquid-Glass platforms) + input fills.
  surface: dyn("rgba(255,255,255,0.72)", "rgba(60,60,74,0.55)"),
  surfaceBorder: dyn("rgba(255,255,255,0.6)", "rgba(255,255,255,0.14)"),
  hairline: dyn("rgba(20,20,30,0.08)", "rgba(255,255,255,0.14)"),
  inputBg: dyn("rgba(255,255,255,0.6)", "rgba(255,255,255,0.08)"),

  danger: "#E5484D",
  success: "#30A46C",
};

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
