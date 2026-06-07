import { v } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/owner";

// Read a user's scan entitlement. Absent row = free tier (false).
export async function getScanEnabled(
  ctx: QueryCtx,
  ownerUserId: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("entitlements")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
    .unique();
  return row?.scanEnabled ?? false;
}

// What the app reads to show/upsell scanning. The authoritative gate lives
// server-side in `receipts.createReceiptWithImage` — this is just for UI.
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const ownerUserId = await requireUserId(ctx);
    return { scanEnabled: await getScanEnabled(ctx, ownerUserId) };
  },
});

// Admin-only: flip a user's scan entitlement. Intentionally no auth check —
// internal functions aren't client-callable, only via `npx convex run` or the
// scheduler. This is the hook a real billing webhook would call later.
export const setScanEnabled = internalMutation({
  args: { ownerUserId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { ownerUserId, enabled }) => {
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        scanEnabled: enabled,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("entitlements", {
        ownerUserId,
        scanEnabled: enabled,
        updatedAt: Date.now(),
      });
    }
  },
});

// One-off convenience: grant scanning to every account that already exists
// (currently just the admin). New sign-ups still default to the free tier.
// Run once with `npx convex run entitlements:grantScanToExistingUsers`.
export const grantScanToExistingUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("members").collect();
    const owners = new Set(members.map((m) => m.ownerUserId));
    for (const ownerUserId of owners) {
      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
        .unique();
      if (!existing) {
        await ctx.db.insert("entitlements", {
          ownerUserId,
          scanEnabled: true,
          updatedAt: Date.now(),
        });
      }
    }
    return [...owners];
  },
});
