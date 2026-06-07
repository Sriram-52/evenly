import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { GlassSurface } from "@/components/glass-surface";
import { CentsInput } from "@/components/ui/cents-input";
import { radius, spacing, initials, useColors, type ThemeColors } from "@/theme";

type Props = {
  item: Doc<"lineItems">;
  roster: Doc<"members">[];
  excludedMemberIds: Set<string>;
  onToggleExclusion: (memberId: Id<"members">) => void;
  onUpdate: (fields: { name?: string; lineTotalCents?: number }) => void;
  onRemove: () => void;
};

export function LineItemCard({
  item,
  roster,
  excludedMemberIds,
  onToggleExclusion,
  onUpdate,
  onRemove,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cents, setCents] = useState(item.lineTotalCents);

  const commitAmount = () => {
    if (cents !== item.lineTotalCents) onUpdate({ lineTotalCents: cents });
  };

  return (
    <GlassSurface style={[styles.card, item.needsReview && styles.review]}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.name}
          defaultValue={item.name}
          onEndEditing={(e) => {
            const next = e.nativeEvent.text.trim();
            if (next && next !== item.name) onUpdate({ name: next });
          }}
          placeholder="Item"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.amountWrap}>
          <Text style={styles.dollar}>$</Text>
          <CentsInput
            style={styles.amount}
            cents={cents}
            onChangeCents={setCents}
            onEndEditing={commitAmount}
          />
        </View>
        <Pressable hitSlop={8} onPress={onRemove} style={styles.trash}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Per-item exclusion grid: tap a roommate to drop them from THIS item. */}
      <View style={styles.chips}>
        {roster.map((m) => {
          const excluded = excludedMemberIds.has(m._id);
          return (
            <Pressable
              key={m._id}
              onPress={() => onToggleExclusion(m._id)}
              style={[styles.chip, excluded ? styles.chipOff : styles.chipOn]}
            >
              <Text style={[styles.chipText, excluded && styles.chipTextOff]}>
                {m.isSelf ? "Me" : initials(m.name)}
              </Text>
            </Pressable>
          );
        })}
        {roster.length === 0 && (
          <Text style={styles.noRoster}>Add roommates to the roster below</Text>
        )}
      </View>
    </GlassSurface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  review: { borderColor: colors.accent, borderWidth: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  amountWrap: { flexDirection: "row", alignItems: "center" },
  dollar: { fontSize: 16, color: colors.textMuted },
  amount: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
    minWidth: 64,
    textAlign: "right",
  },
  trash: { marginLeft: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.brand },
  chipOff: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipText: { fontSize: 14, fontWeight: "700", color: colors.textOnBrand },
  chipTextOff: { color: colors.textMuted },
  noRoster: { color: colors.textMuted, fontSize: 14 },
});
