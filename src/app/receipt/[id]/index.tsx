import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenBackground } from "@/components/screen-background";
import { Button } from "@/components/ui/button";
import { CentsInput } from "@/components/ui/cents-input";
import { AddItemRow } from "@/components/receipt/add-item-row";
import { LineItemCard } from "@/components/receipt/line-item-card";
import { colors, radius, spacing, formatCents } from "@/theme";

export default function ReceiptEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = id as Id<"receipts">;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const data = useQuery(api.receipts.get, { receiptId });
  const allMembers = useQuery(api.members.list);
  const split = useQuery(api.split.compute, { receiptId });

  const addItem = useMutation(api.lineItems.add);
  const updateItem = useMutation(api.lineItems.update);
  const removeItem = useMutation(api.lineItems.remove);
  const toggleExclusion = useMutation(api.exclusions.toggle);
  const setTotals = useMutation(api.receipts.setTotals);
  const setRoster = useMutation(api.receipts.setRoster);
  const ensureSelf = useMutation(api.members.ensureSelf);
  const removeReceipt = useMutation(api.receipts.remove);

  const confirmDelete = () => {
    Alert.alert("Delete receipt", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removeReceipt({ receiptId });
          router.back();
        },
      },
    ]);
  };

  // Make sure the "You" participant exists so it shows as a toggle. Whether
  // you're actually in the split is optional, per receipt.
  useEffect(() => {
    ensureSelf();
  }, [ensureSelf]);

  if (data === undefined || allMembers === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Receipt not found.</Text>
      </View>
    );
  }

  const { receipt, lineItems, rosterMembers, exclusions } = data;
  // Participants on this receipt (includes "you"); used for the exclusion grid.
  const roster = rosterMembers;
  const rosterIds = new Set(rosterMembers.map((m) => m._id as string));

  // lineItemId -> set of excluded member ids.
  const excludedByItem = new Map<string, Set<string>>();
  for (const ex of exclusions) {
    const key = ex.lineItemId as string;
    if (!excludedByItem.has(key)) excludedByItem.set(key, new Set());
    excludedByItem.get(key)!.add(ex.memberId as string);
  }

  const handleAdd = (name: string, cents: number) =>
    addItem({ receiptId, name, lineTotalCents: cents });

  // Toggle a roommate in/out of the receipt. "You" is always kept (we send the
  // current ids, which include self, plus/minus the toggled roommate).
  const toggleRoster = (memberId: Id<"members">) => {
    const currentIds = rosterMembers.map((m) => m._id);
    const next = rosterIds.has(memberId)
      ? currentIds.filter((id) => id !== memberId)
      : [...currentIds, memberId];
    setRoster({ receiptId, memberIds: next });
  };

  const roommatesInRoster = rosterMembers.filter((m) => !m.isSelf);
  const canCollect = lineItems.length > 0 && roommatesInRoster.length > 0;

  // Grand total of everything entered — shown so the user can cross-check
  // against the printed receipt before collecting.
  const itemsTotalCents = lineItems.reduce((s, i) => s + i.lineTotalCents, 0);
  const grandTotalCents =
    itemsTotalCents +
    receipt.taxCents +
    receipt.feesCents -
    receipt.discountCents;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 52 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {receipt.status === "extracting" && (
            <View style={styles.banner}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.bannerText}>Reading your receipt…</Text>
            </View>
          )}
          {receipt.status === "extraction_failed" && (
            <View style={[styles.banner, styles.bannerWarn]}>
              <Text style={[styles.bannerText, { color: colors.accent }]}>
                Couldn&apos;t read the photo — add the items below.
              </Text>
            </View>
          )}

          {/* Store name + purchase date */}
          <GlassSurface style={styles.block}>
            <TextInput
              key={receipt.store ?? "store"}
              style={styles.storeInput}
              placeholder="Store (e.g. Costco)"
              placeholderTextColor={colors.textMuted}
              defaultValue={receipt.store ?? ""}
              onEndEditing={(e) =>
                setTotals({ receiptId, store: e.nativeEvent.text.trim() })
              }
            />
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Purchased</Text>
              <DateTimePicker
                value={new Date(receipt.purchasedAt ?? receipt.createdAt)}
                mode="date"
                display="compact"
                accentColor={colors.brand}
                onChange={(_, d) =>
                  d && setTotals({ receiptId, purchasedAt: d.getTime() })
                }
              />
            </View>
          </GlassSurface>

          {/* Items */}
          <Text style={styles.sectionTitle}>Items</Text>
          {lineItems.map((item) => (
            <LineItemCard
              key={item._id}
              item={item}
              roster={roster}
              excludedMemberIds={excludedByItem.get(item._id) ?? new Set()}
              onToggleExclusion={(memberId) =>
                toggleExclusion({ lineItemId: item._id, memberId })
              }
              onUpdate={(fields) => updateItem({ lineItemId: item._id, ...fields })}
              onRemove={() => removeItem({ lineItemId: item._id })}
            />
          ))}

          {/* Add item */}
          <AddItemRow onAdd={handleAdd} />

          {/* Tax / fees / discount */}
          <Text style={styles.sectionTitle}>Tax & fees</Text>
          <GlassSurface style={styles.block}>
            <DollarField
              label="Tax"
              cents={receipt.taxCents}
              onCommit={(taxCents) => setTotals({ receiptId, taxCents })}
            />
            <DollarField
              label="Fees"
              cents={receipt.feesCents}
              onCommit={(feesCents) => setTotals({ receiptId, feesCents })}
            />
            <DollarField
              label="Discount"
              cents={receipt.discountCents}
              onCommit={(discountCents) => setTotals({ receiptId, discountCents })}
            />
          </GlassSurface>

          {/* Roster — "You" is a toggle just like everyone else. */}
          <Text style={styles.sectionTitle}>Roster</Text>
          <View style={styles.rosterWrap}>
            {allMembers.map((m) => {
              const inRoster = rosterIds.has(m._id);
              return (
                <Pressable
                  key={m._id}
                  onPress={() => toggleRoster(m._id)}
                  style={[
                    styles.rosterChip,
                    inRoster ? styles.rosterOn : styles.rosterOff,
                  ]}
                >
                  <Text
                    style={[styles.rosterText, !inRoster && styles.rosterTextOff]}
                  >
                    {m.isSelf ? "You" : m.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {allMembers.filter((m) => !m.isSelf).length === 0 && (
            <Text style={styles.muted}>
              Add roommates on the Roommates tab first.
            </Text>
          )}

          {/* Live split preview */}
          <Text style={styles.sectionTitle}>Split</Text>
          {split && split.unallocatedCents > 0 && (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                {formatCents(split.unallocatedCents)} isn&apos;t assigned to
                anyone — an item is excluded for everyone.
              </Text>
            </View>
          )}
          <GlassSurface style={styles.block}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Receipt total</Text>
              <Text style={styles.totalValue}>
                {formatCents(grandTotalCents)}
              </Text>
            </View>
            {itemsTotalCents > 0 && (
              <Text style={styles.subtotalNote}>
                {formatCents(itemsTotalCents)} items + tax/fees
              </Text>
            )}
            {!split || split.perMember.length === 0 ? (
              <Text style={[styles.muted, styles.splitHint]}>
                Add items and roommates to see the per-person split.
              </Text>
            ) : (
              <>
                <View style={styles.divider} />
                {split.perMember.map((m) => (
                  <View key={m.memberId} style={styles.splitRow}>
                    <Text style={styles.splitName}>{m.name}</Text>
                    <Text style={styles.splitAmount}>
                      {formatCents(m.totalCents)}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </GlassSurface>

          <Button
            title="Collect"
            onPress={() => router.push({ pathname: "/receipt/[id]/share", params: { id } })}
            disabled={!canCollect}
            style={{ marginTop: spacing.lg }}
          />

          <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete receipt</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function DollarField({
  label,
  cents,
  onCommit,
}: {
  label: string;
  cents: number;
  onCommit: (cents: number) => void;
}) {
  const [val, setVal] = useState(cents);
  // Re-sync when the value changes externally (e.g. AI extraction fills it in
  // after this field has already mounted). Doesn't clobber typing — `cents`
  // only changes on commit, not per keystroke.
  useEffect(() => setVal(cents), [cents]);
  return (
    <View style={styles.dollarField}>
      <Text style={styles.dollarLabel}>{label}</Text>
      <View style={styles.dollarInputWrap}>
        <Text style={styles.dollarSign}>$</Text>
        <CentsInput
          style={styles.dollarInput}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          cents={val}
          onChangeCents={setVal}
          onEndEditing={() => onCommit(val)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  block: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  storeInput: { fontSize: 18, fontWeight: "600", color: colors.text },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLabel: { fontSize: 16, color: colors.text },
  dollarField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dollarLabel: { fontSize: 16, color: colors.text },
  dollarInputWrap: { flexDirection: "row", alignItems: "center" },
  dollarSign: { fontSize: 16, color: colors.textMuted },
  dollarInput: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    minWidth: 70,
    textAlign: "right",
  },
  rosterWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  rosterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  rosterOn: { backgroundColor: colors.brand },
  rosterOff: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rosterText: { fontSize: 15, fontWeight: "600", color: colors.textOnBrand },
  rosterTextOff: { color: colors.textMuted },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 16, fontWeight: "600", color: colors.text },
  totalValue: { fontSize: 24, fontWeight: "800", color: colors.brand },
  subtotalNote: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  splitHint: { marginTop: spacing.sm },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: spacing.sm,
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  splitName: { fontSize: 16, color: colors.text },
  splitAmount: { fontSize: 16, fontWeight: "700", color: colors.text },
  warn: {
    backgroundColor: "rgba(236,72,153,0.12)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warnText: { color: colors.accent, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 15 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(91,91,214,0.12)",
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerWarn: { backgroundColor: "rgba(236,72,153,0.12)" },
  bannerText: { color: colors.brand, fontSize: 15, fontWeight: "600" },
  deleteBtn: { alignItems: "center", paddingVertical: spacing.lg, marginTop: spacing.xs },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: "600" },
});
