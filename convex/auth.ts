import { components } from "./_generated/api";
import { query } from "./_generated/server";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { expo } from "@better-auth/expo";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL;

export const authComponent = createClient<DataModel>(components.betterAuth);

// Auth: email/password + optional Google sign-in.
//
// The server-side `expo()` plugin makes native OAuth work — it trusts the app's
// `evenly://` scheme as an origin and proxies the OAuth redirect back into the
// app as a deep link. Its transitive dep `@better-auth/kysely-adapter` imports
// two migration constants that kysely 0.29.2's ESM barrel forgets to re-export,
// which used to break the Convex (esbuild) bundle. We patch kysely to re-export
// them (`patches/kysely@0.29.2.patch`); that adapter is dead code here (we use
// the Convex adapter), so the patch only needs to satisfy import resolution.
//
// Google is wired only when its credentials are present, so email/password keeps
// working in any deployment that hasn't configured an OAuth client.
const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    trustedOrigins: ["evenly://"],
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    // Let Google sign-in attach to an existing email/password account with the
    // same address (instead of failing with `account_not_linked`). Safe to
    // auto-link only because Google verifies email ownership — hence the
    // explicit `trustedProviders` allowlist. `requireLocalEmailVerified: false`
    // is needed because we don't verify email/password signups
    // (`requireEmailVerification: false`), so the local account is unverified —
    // but Google's verification of the same address is enough to trust the link.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
        requireLocalEmailVerified: false,
      },
    },
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : undefined,
    plugins: [convex({ authConfig }), expo()],
  } satisfies BetterAuthOptions);

// Current signed-in user (or null) for the app UI.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => authComponent.safeGetAuthUser(ctx),
});
