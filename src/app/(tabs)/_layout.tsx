import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "@/theme";

// Native UIKit tab bar — on iOS 26 this renders as the system Liquid Glass
// floating pill (the same one Files/Music use), with the active tab in a glass
// capsule. Only works in a dev/standalone build, not Expo Go.
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.brand}>
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
