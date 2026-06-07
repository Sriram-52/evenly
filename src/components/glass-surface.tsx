import { useMemo } from "react";
import { type ViewProps, StyleSheet, View } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { radius, useTheme, type ThemeColors } from "@/theme";

// Resolve once — it can't change at runtime.
const liquidGlass = isLiquidGlassAvailable();

type Props = ViewProps & {
  /** 'regular' = frosted card, 'clear' = more transparent. */
  glass?: "regular" | "clear";
  tintColor?: string;
};

/**
 * A surface that uses native iOS 26 Liquid Glass when available and falls back
 * to a tasteful translucent card everywhere else (Android, older iOS, web).
 *
 * We pin `colorScheme` to the effective theme rather than leaving it 'auto':
 * 'auto' lets each glass view adapt its light/dark appearance to the content
 * behind it, so cards over a colored area flip dark while others stay light —
 * which looked inconsistent across a screen. Pinning keeps every card uniform.
 */
export function GlassSurface({
  glass = "regular",
  tintColor,
  style,
  children,
  ...rest
}: Props) {
  const { scheme, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (liquidGlass) {
    return (
      <GlassView
        style={[styles.base, style]}
        glassEffectStyle={glass}
        colorScheme={scheme}
        tintColor={tintColor}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.base, styles.fallback, style]} {...rest}>
      {children}
    </View>
  );
}

export const isGlass = liquidGlass;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.md,
      overflow: "hidden",
    },
    fallback: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
    },
  });
