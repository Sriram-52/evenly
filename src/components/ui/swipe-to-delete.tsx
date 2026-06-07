import { type ReactNode, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { radius, spacing, useColors, type ThemeColors } from "@/theme";

const MIN_WIDTH = 92;
// Drag past this fraction of the row width and it deletes on its own.
const FULL_FRACTION = 0.55;

function RightAction({
  drag,
  rowWidth,
  onDelete,
}: {
  drag: SharedValue<number>;
  rowWidth: number;
  onDelete: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const fired = useSharedValue(false);
  // Red panel grows with the swipe (fills the row on a full drag).
  const animatedStyle = useAnimatedStyle(() => ({
    width: Math.max(MIN_WIDTH, -drag.value),
  }));

  useAnimatedReaction(
    () => drag.value,
    (val) => {
      if (!fired.value && rowWidth > 0 && -val > rowWidth * FULL_FRACTION) {
        fired.value = true;
        runOnJS(onDelete)();
      }
    },
  );

  return (
    <Reanimated.View style={[styles.action, animatedStyle]}>
      <Pressable style={styles.actionInner} onPress={onDelete}>
        <Ionicons name="trash" size={22} color="#fff" />
        <Text style={styles.actionText}>Delete</Text>
      </Pressable>
    </Reanimated.View>
  );
}

/**
 * Swipe a row left to reveal a Delete button (tap it), or drag it all the way
 * across to delete immediately. No undo — keep that in mind for the caller.
 */
export function SwipeToDelete({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) {
  const [rowWidth, setRowWidth] = useState(0);
  return (
    <Reanimated.View
      layout={LinearTransition.duration(240)}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
    >
      <ReanimatedSwipeable
        friction={1.5}
        rightThreshold={MIN_WIDTH / 2}
        renderRightActions={(_progress, drag) => (
          <RightAction drag={drag} rowWidth={rowWidth} onDelete={onDelete} />
        )}
      >
        {children}
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    action: {
      backgroundColor: colors.danger,
      marginLeft: spacing.sm,
      borderRadius: radius.md,
      overflow: "hidden",
      justifyContent: "center",
    },
    actionInner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: spacing.md,
    },
    actionText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  });
