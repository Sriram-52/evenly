import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { backdrop, useTheme, type ThemeColors } from "@/theme";

// Soft diagonal gradient with two gentle color washes, adapting to light/dark.
// Subtle enough to read as a refined backdrop, with enough color for the glass
// surfaces (which are pinned to the effective scheme) to pick up.
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const bd = backdrop[scheme];
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={bd.stops}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[styles.wash, styles.washTop, { opacity: bd.washBrand }]}
      />
      <View
        style={[styles.wash, styles.washBottom, { opacity: bd.washAccent }]}
      />
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    wash: { position: "absolute", borderRadius: 320 },
    washTop: {
      width: 560,
      height: 560,
      backgroundColor: colors.brand,
      top: -240,
      right: -180,
    },
    washBottom: {
      width: 520,
      height: 520,
      backgroundColor: colors.accent,
      bottom: -220,
      left: -180,
    },
  });
