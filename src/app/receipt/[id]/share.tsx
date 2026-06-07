import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenBackground } from "@/components/screen-background";
import { useToast } from "@/components/ui/toast";
import { radius, spacing, formatCents, useColors, type ThemeColors } from "@/theme";

export default function ShareScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = id as Id<"receipts">;
  const shares = useQuery(api.split.shareText, { receiptId });
  const receipt = useQuery(api.receipts.getOne, { receiptId });
  const setSettled = useMutation(api.receipts.setSettled);
  const { show, toast } = useToast();
  const insets = useSafeAreaInsets();

  const toggleSettled = () => {
    if (!receipt) return;
    const next = !receipt.settledAt;
    setSettled({ receiptId, settled: next });
    show(next ? "Marked as settled" : "Reopened");
  };

  const copyText = async (text: string, toastLabel: string) => {
    try {
      await Clipboard.setStringAsync(text);
      show(toastLabel);
    } catch {
      show("Couldn't copy — try again");
    }
  };

  // The number only ("5.43") — what you paste into your payment app.
  const copyAmount = (cents: number) =>
    copyText((cents / 100).toFixed(2), `Copied ${formatCents(cents)}`);

  if (shares === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (shares === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Receipt not found.</Text>
      </View>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 52 }]}
      >
        <Text style={styles.hint}>
          Tap a roommate&apos;s amount to copy it, then send them a request in
          your payment app. The breakdown is there if they ask.
        </Text>

        {shares.map((s) => (
          <GlassSurface key={s.memberId} style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.amountRow, pressed && styles.pressed]}
              onPress={() => copyAmount(s.totalCents)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                {!!s.zelleHandle && (
                  <Text style={styles.handle}>{s.zelleHandle}</Text>
                )}
              </View>
              <Text style={styles.total}>{formatCents(s.totalCents)}</Text>
              <Ionicons
                name="copy-outline"
                size={18}
                color={colors.brand}
                style={styles.copyIcon}
              />
            </Pressable>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                onPress={() => copyText(s.text, "Copied breakdown")}
              >
                <Ionicons name="list-outline" size={16} color={colors.brand} />
                <Text style={styles.actionText}>Breakdown</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                onPress={() => Share.share({ message: s.text })}
              >
                <Ionicons name="share-outline" size={16} color={colors.brand} />
                <Text style={styles.actionText}>Share</Text>
              </Pressable>
            </View>
          </GlassSurface>
        ))}

        {shares.length === 0 && (
          <Text style={styles.hint}>Nothing to collect yet.</Text>
        )}

        {receipt && shares.length > 0 && (
          <Pressable
            onPress={toggleSettled}
            style={({ pressed }) => [
              styles.settleBtn,
              receipt.settledAt ? styles.settleBtnDone : styles.settleBtnOpen,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={
                receipt.settledAt
                  ? "checkmark-circle"
                  : "checkmark-circle-outline"
              }
              size={20}
              color={receipt.settledAt ? colors.success : colors.brand}
            />
            <Text
              style={[
                styles.settleText,
                !!receipt.settledAt && styles.settleTextDone,
              ]}
            >
              {receipt.settledAt ? "Settled — tap to reopen" : "Mark as settled"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      </SafeAreaView>
      {toast}
    </ScreenBackground>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  card: { padding: spacing.lg, gap: spacing.md },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  handle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  total: { fontSize: 26, fontWeight: "800", color: colors.brand },
  copyIcon: { marginLeft: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: "rgba(91,91,214,0.10)",
  },
  pressed: { opacity: 0.55 },
  actionText: { color: colors.brand, fontWeight: "600", fontSize: 15 },
  settleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    borderWidth: 1,
  },
  settleBtnOpen: { borderColor: colors.brand },
  settleBtnDone: {
    borderColor: colors.success,
    backgroundColor: "rgba(48,164,108,0.12)",
  },
  settleText: { fontSize: 16, fontWeight: "600", color: colors.brand },
  settleTextDone: { color: colors.success },
});
