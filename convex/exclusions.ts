import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/owner";

// Toggle whether a member is EXCLUDED from a line item. Presence of the row =
// excluded. One keyed insert/delete — no array read-modify-write.
export const toggle = mutation({
  args: { lineItemId: v.id("lineItems"), memberId: v.id("members") },
  handler: async (ctx, { lineItemId, memberId }) => {
    const ownerUserId = await requireUserId(ctx);
    const item = await ctx.db.get(lineItemId);
    if (!item || item.ownerUserId !== ownerUserId) {
      throw new Error("Line item not found");
    }

    const existing = await ctx.db
      .query("itemExclusions")
      .withIndex("by_lineItem_member", (q) =>
        q.eq("lineItemId", lineItemId).eq("memberId", memberId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { excluded: false };
    }
    await ctx.db.insert("itemExclusions", {
      receiptId: item.receiptId,
      lineItemId,
      memberId,
    });
    return { excluded: true };
  },
});

export const listForReceipt = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) {
      throw new Error("Receipt not found");
    }
    return ctx.db
      .query("itemExclusions")
      .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
      .collect();
  },
});
