import * as SecureStore from "expo-secure-store";
import type { ThemeMode } from "@/theme";

const KEY = "theme-mode";

// Persisted theme preference (Automatic / Light / Dark). Defaults to Automatic.
export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v === "light" || v === "dark" || v === "automatic") return v;
  } catch {
    // SecureStore unavailable — fall through to the default.
  }
  return "automatic";
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, mode);
  } catch {
    // Best-effort; the in-memory state still applies for this session.
  }
}
