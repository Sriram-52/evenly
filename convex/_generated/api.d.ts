/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as demo from "../demo.js";
import type * as entitlements from "../entitlements.js";
import type * as exclusions from "../exclusions.js";
import type * as extract from "../extract.js";
import type * as http from "../http.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_split from "../lib/split.js";
import type * as lineItems from "../lineItems.js";
import type * as members from "../members.js";
import type * as receipts from "../receipts.js";
import type * as split from "../split.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  demo: typeof demo;
  entitlements: typeof entitlements;
  exclusions: typeof exclusions;
  extract: typeof extract;
  http: typeof http;
  "lib/owner": typeof lib_owner;
  "lib/split": typeof lib_split;
  lineItems: typeof lineItems;
  members: typeof members;
  receipts: typeof receipts;
  split: typeof split;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
