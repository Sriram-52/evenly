import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUserId } from "./lib/owner";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function ownedReceipt(
  ctx: MutationCtx,
  receiptId: Id<"receipts">,
  ownerUserId: string,
) {
  const receipt = await ctx.db.get(receiptId);
  if (!receipt || receipt.ownerUserId !== ownerUserId) {
    throw new Error("Receipt not found");
  }
  return receipt;
}

export const add = mutation({
  args: {
    receiptId: v.id("receipts"),
    name: v.string(),
    lineTotalCents: v.number(),
    unitPriceCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerUserId = await requireUserId(ctx);
    await ownedReceipt(ctx, args.receiptId, ownerUserId);

    const existing = await ctx.db
      .query("lineItems")
      .withIndex("by_receipt", (q) => q.eq("receiptId", args.receiptId))
      .collect();
    const sortOrder =
      existing.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;

    return ctx.db.insert("lineItems", {
      receiptId: args.receiptId,
      ownerUserId,
      name: args.name,
      lineTotalCents: args.lineTotalCents,
      unitPriceCents: args.unitPriceCents,
      quantity: args.quantity,
      needsReview: false,
      sortOrder,
    });
  },
});

export const update = mutation({
  args: {
    lineItemId: v.id("lineItems"),
    name: v.optional(v.string()),
    lineTotalCents: v.optional(v.number()),
    unitPriceCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    needsReview: v.optional(v.boolean()),
  },
  handler: async (ctx, { lineItemId, ...fields }) => {
    const ownerUserId = await requireUserId(ctx);
    const item = await ctx.db.get(lineItemId);
    if (!item || item.ownerUserId !== ownerUserId) {
      throw new Error("Line item not found");
    }
    await ctx.db.patch(lineItemId, fields);
  },
});

export const remove = mutation({
  args: { lineItemId: v.id("lineItems") },
  handler: async (ctx, { lineItemId }) => {
    const ownerUserId = await requireUserId(ctx);
    const item = await ctx.db.get(lineItemId);
    if (!item || item.ownerUserId !== ownerUserId) {
      throw new Error("Line item not found");
    }
    // Cascade: drop any exclusions referencing this item.
    const exclusions = await ctx.db
      .query("itemExclusions")
      .withIndex("by_lineItem", (q) => q.eq("lineItemId", lineItemId))
      .collect();
    for (const ex of exclusions) await ctx.db.delete(ex._id);
    await ctx.db.delete(lineItemId);
  },
});
