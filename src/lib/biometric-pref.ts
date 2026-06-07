import * as SecureStore from "expo-secure-store";

const KEY = "biometric-enabled";

// Whether the Face ID / biometric launch gate is on. Defaults to enabled.
export async function getBiometricEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(KEY);
  return v !== "false";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY, enabled ? "true" : "false");
}
