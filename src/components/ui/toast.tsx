import { useCallback, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, radius } from "@/theme";

/**
 * Minimal dependency-free toast. Returns a `show(message)` fn and a `toast`
 * element to render at the root of a screen (it positions itself).
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      opacity.stopAnimation();
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMessage(null);
      });
    },
    [opacity],
  );

  const toast = message ? (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  ) : null;

  return { show, toast };
}

/**
 * Toast with an "Undo" action, auto-dismissing after a few seconds. Pair with a
 * soft-delete: show it after deleting, and run the reversal on Undo.
 */
export function useUndoToast() {
  const [state, setState] = useState<{
    message: string;
    onUndo: () => void;
  } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setState(null);
    });
  }, [opacity]);

  const show = useCallback(
    (message: string, onUndo: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      setState({ message, onUndo });
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(dismiss, 4500);
    },
    [opacity, dismiss],
  );

  const undo = useCallback(() => {
    state?.onUndo();
    if (timer.current) clearTimeout(timer.current);
    dismiss();
  }, [state, dismiss]);

  const toast = state ? (
    <Animated.View style={[styles.undoWrap, { opacity }]}>
      <View style={styles.undoPill}>
        <Text style={styles.text}>{state.message}</Text>
        <Pressable onPress={undo} hitSlop={8}>
          <Text style={styles.undoAction}>Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  ) : null;

  return { show, toast };
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 48,
    alignItems: "center",
  },
  pill: {
    backgroundColor: "rgba(20,20,28,0.92)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  text: { color: "#fff", fontSize: 15, fontWeight: "600" },
  undoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: "center",
  },
  undoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: "rgba(20,20,28,0.94)",
    paddingLeft: spacing.xl,
    paddingRight: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  undoAction: { color: colors.brand, fontSize: 15, fontWeight: "800" },
});
