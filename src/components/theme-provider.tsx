import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import { ThemeContext, colorsFor, type ThemeMode } from "@/theme";
import { getThemeMode, setThemeMode } from "@/lib/theme-mode";

// Owns the theme: resolves the effective scheme from the user's preference
// (Automatic follows the OS) and exposes colors via context so consumers
// re-render live when it changes.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("automatic");

  useEffect(() => {
    getThemeMode().then(setModeState);
  }, []);

  // Override the app-wide native appearance so native chrome (the tab bar,
  // status bar, native date picker) follows the choice too — not just our JS
  // colors. "unspecified" restores following the OS.
  useEffect(() => {
    Appearance.setColorScheme(mode === "automatic" ? "unspecified" : mode);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void setThemeMode(m);
  }, []);

  const scheme =
    mode === "automatic" ? (system === "dark" ? "dark" : "light") : mode;

  const value = useMemo(
    () => ({ colors: colorsFor(scheme), scheme, mode, setMode }),
    [scheme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
