import { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenBackground } from "@/components/screen-background";
import { Button } from "@/components/ui/button";
import { SwipeToDelete } from "@/components/ui/swipe-to-delete";
import { useUndoToast } from "@/components/ui/toast";
import { colors, radius, spacing, formatCents } from "@/theme";

const STATUS_LABEL: Record<Doc<"receipts">["status"], string> = {
  draft: "Draft",
  extracting: "Reading…",
  ready: "Ready",
  extraction_failed: "Needs entry",
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const receipts = useQuery(api.receipts.list);
  const createBlank = useMutation(api.receipts.createBlankReceipt);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const createWithImage = useMutation(api.receipts.createReceiptWithImage);
  const softDelete = useMutation(api.receipts.softDelete);
  const undoDelete = useMutation(api.receipts.undoDelete);
  const canScan = useQuery(api.entitlements.getMine)?.scanEnabled ?? false;
  const { show: showUndo, toast: undoToast } = useUndoToast();
  const [creating, setCreating] = useState(false);

  const showScanUpsell = () => {
    Alert.alert(
      "Evenly Plus",
      "Receipt scanning reads items for you automatically — it's part of Evenly Plus. For now, you can enter the receipt manually.",
      [{ text: "OK" }],
    );
  };

  const deleteReceipt = (receiptId: Id<"receipts">) => {
    softDelete({ receiptId });
    showUndo("Receipt deleted", () => undoDelete({ receiptId }));
  };

  const newReceipt = async () => {
    setCreating(true);
    try {
      const id = await createBlank({});
      router.push({ pathname: "/receipt/[id]", params: { id } });
    } finally {
      setCreating(false);
    }
  };

  // Snap or pick a receipt photo → downscale → upload → create + extract.
  const scan = async (source: "camera" | "library") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        `Allow ${source === "camera" ? "camera" : "photo"} access to scan receipts.`,
      );
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
          });
    if (result.canceled) return;

    setCreating(true);
    try {
      // Downscale to ~1024px wide JPEG to keep upload + token cost small.
      const ctx = ImageManipulator.manipulate(result.assets[0].uri);
      ctx.resize({ width: 1024 });
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
      });

      // Upload the file directly (RN fetch can't make a Blob from binary files).
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await uploadAsync(uploadUrl, out.uri, {
        httpMethod: "POST",
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": "image/jpeg" },
      });
      const { storageId } = JSON.parse(uploadResult.body);
      const id = await createWithImage({ imageStorageId: storageId });
      router.push({ pathname: "/receipt/[id]", params: { id } });
    } catch (e) {
      console.error("scan failed:", e);
      Alert.alert("Couldn't scan", "Try again, or enter the receipt manually.");
    } finally {
      setCreating(false);
    }
  };

  // Import a PDF invoice → upload as-is → Gemini reads the document directly.
  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    setCreating(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await uploadAsync(uploadUrl, result.assets[0].uri, {
        httpMethod: "POST",
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": "application/pdf" },
      });
      const { storageId } = JSON.parse(uploadResult.body);
      const id = await createWithImage({ imageStorageId: storageId });
      router.push({ pathname: "/receipt/[id]", params: { id } });
    } catch (e) {
      console.error("pdf import failed:", e);
      Alert.alert("Couldn't import", "Try again, or enter the receipt manually.");
    } finally {
      setCreating(false);
    }
  };

  const startNewReceipt = () => {
    if (Platform.OS !== "ios") {
      newReceipt();
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "New receipt",
        options: [
          "Scan with camera",
          "Choose photo",
          "Import PDF",
          "Enter manually",
          "Cancel",
        ],
        cancelButtonIndex: 4,
      },
      (i) => {
        // Scan options (0–2) are gated; manual entry (3) is always free.
        if ((i === 0 || i === 1 || i === 2) && !canScan) {
          showScanUpsell();
          return;
        }
        if (i === 0) scan("camera");
        else if (i === 1) scan("library");
        else if (i === 2) pickPdf();
        else if (i === 3) newReceipt();
      },
    );
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {receipts === undefined ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : receipts.length === 0 ? (
          <GlassSurface glass="regular" style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color={colors.brand} />
            <Text style={styles.emptyTitle}>No receipts yet</Text>
            <Text style={styles.emptyBody}>
              Start one, add the items, and split it.
            </Text>
          </GlassSurface>
        ) : (
          receipts.map((r) => (
            <SwipeToDelete key={r._id} onDelete={() => deleteReceipt(r._id)}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/receipt/[id]", params: { id: r._id } })
                }
              >
                <GlassSurface style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName}>{r.store || "Receipt"}</Text>
                    <View style={styles.rowDate}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={colors.textMuted}
                      />
                      <Text style={styles.rowSub}>
                        {formatDate(r.purchasedAt ?? r.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowTotal}>
                      {formatCents(r.totalCents)}
                    </Text>
                    {r.settledAt ? (
                      <Text style={[styles.badge, styles.badgeSettled]}>
                        Settled
                      </Text>
                    ) : (
                      <Text style={styles.badge}>{STATUS_LABEL[r.status]}</Text>
                    )}
                  </View>
                </GlassSurface>
              </Pressable>
            </SwipeToDelete>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="New receipt" onPress={startNewReceipt} loading={creating} />
      </View>
      </SafeAreaView>
      {undoToast}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  rowMain: { gap: 3 },
  rowName: { fontSize: 17, fontWeight: "600", color: colors.text },
  rowDate: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowSub: { fontSize: 14, color: colors.textMuted },
  rowRight: { alignItems: "flex-end", gap: 5 },
  rowTotal: { fontSize: 18, fontWeight: "800", color: colors.brand },
  badge: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
    backgroundColor: "rgba(91,91,214,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  badgeSettled: {
    color: colors.success,
    backgroundColor: "rgba(48,164,108,0.14)",
  },
  emptyCard: {
    marginTop: spacing.xxl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  emptyBody: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 96,
  },
});
