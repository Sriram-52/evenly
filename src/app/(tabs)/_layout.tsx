import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColors } from "@/theme";

// Native UIKit tab bar — on iOS 26 this renders as the system Liquid Glass
// floating pill (the same one Files/Music use), with the active tab in a glass
// capsule. Only works in a dev/standalone build, not Expo Go.
export default function TabsLayout() {
  const colors = useColors();
  // Theme the Android bar explicitly so it follows the chosen theme (its native
  // bar doesn't repaint from Appearance overrides). Leave iOS to its native
  // Liquid Glass — overriding backgroundColor there would kill the glass.
  const android = Platform.OS === "android";
  return (
    <NativeTabs
      tintColor={colors.brand}
      backgroundColor={android ? colors.sheet : undefined}
      iconColor={android ? colors.textMuted : undefined}
      labelStyle={android ? { color: colors.textMuted } : undefined}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
        <NativeTabs.Trigger.Label>Receipts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="members">
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
        <NativeTabs.Trigger.Label>Roommates</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
