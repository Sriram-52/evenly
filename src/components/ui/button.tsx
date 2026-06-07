import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { colors, radius, spacing } from "@/theme";

const liquidGlass = isLiquidGlassAvailable();

type Props = Omit<PressableProps, "children"> & {
  title: string;
  variant?: "primary" | "glass";
  loading?: boolean;
};

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const isPrimary = variant === "primary";

  const content = loading ? (
    <ActivityIndicator color={isPrimary ? colors.textOnBrand : colors.brand} />
  ) : (
    <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelGlass]}>
      {title}
    </Text>
  );

  // Glass variant uses an interactive Liquid Glass capsule where available.
  if (variant === "glass" && liquidGlass) {
    return (
      <Pressable disabled={disabled || loading} style={style} {...rest}>
        <GlassView
          style={styles.base}
          glassEffectStyle="clear"
          isInteractive
        >
          {content}
        </GlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        isPrimary ? styles.primary : styles.glassFallback,
        (state.pressed || disabled) && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  primary: { backgroundColor: colors.brand },
  glassFallback: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceBorder,
  },
  pressed: { opacity: 0.85 },
  label: { fontSize: 16, fontWeight: "600" },
  labelPrimary: { color: colors.textOnBrand },
  labelGlass: { color: colors.brand },
});
