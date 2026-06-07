import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts/legacy";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenBackground } from "@/components/screen-background";
import { Button } from "@/components/ui/button";
import { SwipeToDelete } from "@/components/ui/swipe-to-delete";
import { useUndoToast } from "@/components/ui/toast";
import { radius, spacing, useColors, type ThemeColors } from "@/theme";

export default function MembersScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allMembers = useQuery(api.members.list);
  // "You" is a split participant, not a roommate — keep it off this list.
  const members = allMembers?.filter((m) => !m.isSelf);
  const addMember = useMutation(api.members.add);
  const archiveMember = useMutation(api.members.archive);
  const unarchiveMember = useMutation(api.members.unarchive);
  const { show: showUndo, toast: undoToast } = useUndoToast();

  const deleteMember = (memberId: Id<"members">) => {
    archiveMember({ memberId });
    showUndo("Roommate removed", () => unarchiveMember({ memberId }));
  };

  const [name, setName] = useState("");
  const [zelle, setZelle] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addMember({
        name: name.trim(),
        zelleHandle: zelle.trim() || undefined,
      });
      setName("");
      setZelle("");
    } finally {
      setSaving(false);
    }
  };

  // Native iOS contact picker (no full-contacts permission needed — the user
  // explicitly picks one). Prefill name + a contact (phone first, then email)
  // so they can confirm before adding.
  const pickFromContacts = async () => {
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const fullName =
        contact.name?.trim() ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      const handle =
        contact.phoneNumbers?.[0]?.number ?? contact.emails?.[0]?.email ?? "";
      if (fullName) setName(fullName);
      if (handle) setZelle(handle);
    } catch {
      // Picker dismissed or unavailable — no-op.
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Roommates</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <GlassSurface style={styles.addCard}>
            <Pressable style={styles.contactsBtn} onPress={pickFromContacts}>
              <Ionicons name="person-add-outline" size={20} color={colors.brand} />
              <Text style={styles.contactsText}>Add from Contacts</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone or email (optional)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={zelle}
              onChangeText={setZelle}
            />
            <Button
              title="Add roommate"
              onPress={add}
              loading={saving}
              disabled={!name.trim()}
            />
          </GlassSurface>

          {members === undefined ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : members.length === 0 ? (
            <Text style={styles.empty}>
              No roommates yet. Add the people you split bills with.
            </Text>
          ) : (
            members.map((m) => (
              <SwipeToDelete key={m._id} onDelete={() => deleteMember(m._id)}>
                <GlassSurface style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName}>{m.name}</Text>
                    {!!m.zelleHandle && (
                      <Text style={styles.rowSub}>{m.zelleHandle}</Text>
                    )}
                  </View>
                </GlassSurface>
              </SwipeToDelete>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
      {undoToast}
    </ScreenBackground>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  addCard: { padding: spacing.lg, gap: spacing.md, marginBottom: spacing.sm },
  contactsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  contactsText: { color: colors.brand, fontSize: 15, fontWeight: "600" },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  rowMain: { gap: 2 },
  rowName: { fontSize: 17, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 14, color: colors.textMuted },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
});
