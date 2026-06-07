import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassSurface } from "@/components/glass-surface";
import { CentsInput } from "@/components/ui/cents-input";
import { colors, spacing } from "@/theme";

/**
 * Self-contained "add item" row. Keeping its state local means typing here never
 * re-renders the editor (with its live split + every line-item card), which is
 * what caused the input flicker. The name field is uncontrolled (read on
 * submit); only the amount needs to be controlled for cents-first formatting.
 * Adds on the + button, on return, or on blur with a valid name + amount.
 */
export function AddItemRow({
  onAdd,
}: {
  onAdd: (name: string, cents: number) => void;
}) {
  const nameRef = useRef("");
  const [cents, setCents] = useState(0);
  // Remount the uncontrolled name input to clear it after an add.
  const [resetKey, setResetKey] = useState(0);

  const submit = () => {
    const name = nameRef.current.trim();
    if (!name || cents <= 0) return;
    onAdd(name, cents);
    nameRef.current = "";
    setCents(0);
    setResetKey((k) => k + 1);
  };

  return (
    <GlassSurface style={styles.row}>
      <TextInput
        key={resetKey}
        style={styles.name}
        placeholder="Add item"
        placeholderTextColor={colors.textMuted}
        defaultValue=""
        onChangeText={(t) => (nameRef.current = t)}
        onEndEditing={submit}
      />
      <CentsInput
        style={styles.amount}
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
        cents={cents}
        onChangeCents={setCents}
        onSubmitEditing={submit}
        onEndEditing={submit}
      />
      <Pressable onPress={submit} hitSlop={8}>
        <Text style={styles.plus}>＋</Text>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 16, color: colors.text },
  amount: {
    fontSize: 16,
    color: colors.text,
    minWidth: 64,
    textAlign: "right",
  },
  plus: { fontSize: 26, color: colors.brand, fontWeight: "600" },
});
