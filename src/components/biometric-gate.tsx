import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { getBiometricEnabled } from "@/lib/biometric-pref";

/**
 * Gates its children behind a device biometric / passcode prompt on every app
 * open. If the device has no biometric hardware or nothing enrolled, it passes
 * through rather than locking the user out (the signed-in session still
 * protects the data). Sits *inside* the Authenticated boundary, so it only
 * runs once the user actually has a session.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  const authenticate = useCallback(async () => {
    setChecking(true);
    try {
      // Respect the user's preference (Profile → Security toggle).
      if (!(await getBiometricEnabled())) {
        setUnlocked(true);
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setUnlocked(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Evenly",
        fallbackLabel: "Use passcode",
      });
      setUnlocked(result.success);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  if (unlocked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Evenly is locked</Text>
      <Pressable
        style={[styles.button, checking && styles.buttonDisabled]}
        onPress={authenticate}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Unlock</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: "600" },
  button: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
