import { DefaultTheme, ThemeProvider, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import {
  Authenticated,
  AuthLoading,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { BiometricGate } from "@/components/biometric-gate";
import { SignInScreen } from "@/components/sign-in-screen";
import { ScreenBackground } from "@/components/screen-background";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string,
  { expectAuth: true },
);

// Transparent navigator theme so the gradient backdrop shows through every screen.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};

function FullScreenLoader() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="dark" />
        <ScreenBackground>
          <AuthLoading>
            <FullScreenLoader />
          </AuthLoading>
          <Unauthenticated>
            <SignInScreen />
          </Unauthenticated>
          <Authenticated>
            <BiometricGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "transparent" },
                  // Show just the chevron, not the previous route's name ("(tabs)").
                  headerBackButtonDisplayMode: "minimal",
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="receipt/[id]/index"
                  options={{
                    headerShown: true,
                    headerTransparent: true,
                    title: "Receipt",
                  }}
                />
                <Stack.Screen
                  name="receipt/[id]/share"
                  options={{
                    headerShown: true,
                    headerTransparent: true,
                    title: "Collect",
                  }}
                />
                <Stack.Screen
                  name="change-password"
                  options={{
                    headerShown: true,
                    headerTransparent: true,
                    title: "Change password",
                    presentation: "modal",
                  }}
                />
              </Stack>
            </BiometricGate>
          </Authenticated>
        </ScreenBackground>
      </ThemeProvider>
      </ConvexBetterAuthProvider>
    </GestureHandlerRootView>
  );
}
