import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const scheme = Constants.expoConfig?.scheme as string;

// Better Auth client for Expo: the session token is persisted in the device
// keychain via expo-secure-store, and the convex plugin bridges auth state to
// the Convex reactive client.
export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  plugins: [
    expoClient({ scheme, storagePrefix: scheme, storage: SecureStore }),
    convexClient(),
  ],
});
