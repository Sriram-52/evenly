import { type ComponentProps, type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  getBiometricEnabled,
  setBiometricEnabled,
} from "@/lib/biometric-pref";
import { ScreenBackground } from "@/components/screen-background";
import { GlassSurface } from "@/components/glass-surface";
import { colors, radius, spacing, initials } from "@/theme";

function Row({
  icon,
  label,
  value,
  onPress,
  right,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const content = (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Text style={styles.rowLabel}>{label}</Text>
      {right ?? (value ? <Text style={styles.rowValue}>{value}</Text> : null)}
      {onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);
  const name = user?.name?.trim() || "You";

  const [bioEnabled, setBioEnabled] = useState(true);
  useEffect(() => {
    getBiometricEnabled().then(setBioEnabled);
  }, []);

  const toggleBio = async (val: boolean) => {
    setBioEnabled(val);
    await setBiometricEnabled(val);
  };

  const editName = () => {
    Alert.prompt(
      "Edit name",
      undefined,
      async (text) => {
        const next = text?.trim();
        if (next && next !== name) await authClient.updateUser({ name: next });
      },
      "plain-text",
      name === "You" ? "" : name,
    );
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <GlassSurface style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {user === undefined ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Text style={styles.name}>{name}</Text>
                  {!!user?.email && (
                    <Text style={styles.email}>{user.email}</Text>
                  )}
                </>
              )}
            </View>
          </GlassSurface>

          <Text style={styles.sectionTitle}>Account</Text>
          <GlassSurface style={styles.card}>
            <Row
              icon="person-outline"
              label="Edit name"
              value={name}
              onPress={editName}
            />
            <View style={styles.divider} />
            <Row
              icon="lock-closed-outline"
              label="Change password"
              onPress={() => router.push("/change-password")}
            />
          </GlassSurface>

          <Text style={styles.sectionTitle}>Security</Text>
          <GlassSurface style={styles.card}>
            <Row
              icon="finger-print"
              label="Biometric unlock"
              right={
                <Switch
                  value={bioEnabled}
                  onValueChange={toggleBio}
                  trackColor={{ true: colors.brand }}
                />
              }
            />
          </GlassSurface>

          <Text style={styles.sectionTitle}>About</Text>
          <GlassSurface style={styles.card}>
            <Row icon="information-circle-outline" label="Version" value="1.0.0" />
          </GlassSurface>

          <Pressable
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
            onPress={() => authClient.signOut()}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 32, fontWeight: "700", color: colors.text },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.md,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textOnBrand, fontSize: 22, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  email: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  card: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
  rowValue: { fontSize: 16, color: colors.textMuted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  pressed: { opacity: 0.6 },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: "700" },
});
