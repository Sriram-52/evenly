import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/owner";
import { ensureSelfMember } from "./members";
import { getScanEnabled } from "./entitlements";

// Delete a receipt and everything hanging off it (items, exclusions, roster,
// stored image).
async function cascadeDelete(ctx: MutationCtx, receiptId: Id<"receipts">) {
  const lineItems = await ctx.db
    .query("lineItems")
    .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
    .collect();
  const exclusions = await ctx.db
    .query("itemExclusions")
    .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
    .collect();
  const rosterRows = await ctx.db
    .query("receiptMembers")
    .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
    .collect();
  for (const row of [...lineItems, ...exclusions, ...rosterRows]) {
    await ctx.db.delete(row._id);
  }
  const receipt = await ctx.db.get(receiptId);
  if (receipt?.imageStorageId) {
    await ctx.storage.delete(receipt.imageStorageId);
  }
  await ctx.db.delete(receiptId);
}

// Newest-first list for the receipts screen, each with its grand total
// (items + tax + fees - discount) so the card can show it without a separate read.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerUserId = await requireUserId(ctx);
    const receipts = (
      await ctx.db
        .query("receipts")
        .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
        .order("desc")
        .collect()
    ).filter((r) => !r.deletedAt);

    return Promise.all(
      receipts.map(async (r) => {
        const items = await ctx.db
          .query("lineItems")
          .withIndex("by_receipt", (q) => q.eq("receiptId", r._id))
          .collect();
        const itemsTotal = items.reduce((s, i) => s + i.lineTotalCents, 0);
        const totalCents =
          itemsTotal + r.taxCents + r.feesCents - r.discountCents;
        return { ...r, totalCents };
      }),
    );
  },
});

// Just the receipt doc (for screens that don't need the full editor payload).
export const getOne = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) return null;
    return receipt;
  },
});

// Manually mark a receipt collected/done (or reopen it).
export const setSettled = mutation({
  args: { receiptId: v.id("receipts"), settled: v.boolean() },
  handler: async (ctx, { receiptId, settled }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) {
      throw new Error("Receipt not found");
    }
    await ctx.db.patch(receiptId, {
      settledAt: settled ? Date.now() : undefined,
    });
  },
});

// Everything the receipt editor needs in one reactive read.
export const get = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) return null;

    const lineItems = (
      await ctx.db
        .query("lineItems")
        .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
        .collect()
    ).sort((a, b) => a.sortOrder - b.sortOrder);

    const rosterRows = await ctx.db
      .query("receiptMembers")
      .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
      .collect();
    const rosterMembers = (
      await Promise.all(rosterRows.map((r) => ctx.db.get(r.memberId)))
    ).filter((m): m is NonNullable<typeof m> => m !== null);
    // "You" first, then roommates.
    rosterMembers.sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf));

    const exclusions = await ctx.db
      .query("itemExclusions")
      .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
      .collect();

    return { receipt, lineItems, rosterMembers, exclusions };
  },
});

// Manual-entry path: an empty draft to fill in by hand (also the fallback when
// AI extraction fails).
export const createBlankReceipt = mutation({
  args: { store: v.optional(v.string()) },
  handler: async (ctx, { store }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const ownerUserId = identity.subject;

    const now = Date.now();
    const receiptId = await ctx.db.insert("receipts", {
      ownerUserId,
      store,
      status: "draft",
      taxCents: 0,
      feesCents: 0,
      discountCents: 0,
      purchasedAt: now,
      createdAt: now,
    });

    // Make sure the admin's own participant exists, then default the roster to
    // self + all active roommates.
    await ensureSelfMember(ctx, ownerUserId, identity.name?.trim() || "You");
    const members = await ctx.db
      .query("members")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .collect();
    for (const m of members) {
      if (!m.isArchived) {
        await ctx.db.insert("receiptMembers", { receiptId, memberId: m._id });
      }
    }
    return receiptId;
  },
});

// Photo path — get an upload URL for the receipt image.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

// Create a receipt from an uploaded photo and kick off AI extraction.
export const createReceiptWithImage = mutation({
  args: { imageStorageId: v.id("_storage") },
  handler: async (ctx, { imageStorageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const ownerUserId = identity.subject;

    // Paywall gate: AI scanning is the only thing that costs money. Free-tier
    // users fall back to manual entry (the client steers them there).
    if (!(await getScanEnabled(ctx, ownerUserId))) {
      throw new Error("Scanning isn't enabled for this account");
    }

    const now = Date.now();
    const receiptId = await ctx.db.insert("receipts", {
      ownerUserId,
      imageStorageId,
      status: "extracting",
      taxCents: 0,
      feesCents: 0,
      discountCents: 0,
      purchasedAt: now,
      createdAt: now,
    });

    await ensureSelfMember(ctx, ownerUserId, identity.name?.trim() || "You");
    const members = await ctx.db
      .query("members")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .collect();
    for (const m of members) {
      if (!m.isArchived) {
        await ctx.db.insert("receiptMembers", { receiptId, memberId: m._id });
      }
    }

    await ctx.scheduler.runAfter(0, internal.extract.run, {
      receiptId,
      imageStorageId,
    });
    return receiptId;
  },
});

// Called by the extraction action with the model's parsed result.
export const applyExtraction = internalMutation({
  args: {
    receiptId: v.id("receipts"),
    store: v.optional(v.string()),
    taxCents: v.number(),
    feesCents: v.number(),
    discountCents: v.number(),
    printedTotalCents: v.optional(v.number()),
    purchasedAt: v.optional(v.number()),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        lineTotalCents: v.number(),
        needsReview: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) return;

    await ctx.db.patch(args.receiptId, {
      store: args.store ?? receipt.store,
      taxCents: args.taxCents,
      feesCents: args.feesCents,
      discountCents: args.discountCents,
      printedTotalCents: args.printedTotalCents,
      purchasedAt: args.purchasedAt ?? receipt.purchasedAt,
      status: "ready",
    });

    let sortOrder = 0;
    for (const it of args.items) {
      await ctx.db.insert("lineItems", {
        receiptId: args.receiptId,
        ownerUserId: receipt.ownerUserId,
        name: it.name,
        lineTotalCents: it.lineTotalCents,
        quantity: it.quantity,
        needsReview: it.needsReview,
        sortOrder: sortOrder++,
      });
    }
  },
});

export const markExtractionFailed = internalMutation({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    await ctx.db.patch(receiptId, { status: "extraction_failed" });
  },
});

export const setTotals = mutation({
  args: {
    receiptId: v.id("receipts"),
    store: v.optional(v.string()),
    taxCents: v.optional(v.number()),
    feesCents: v.optional(v.number()),
    discountCents: v.optional(v.number()),
    printedTotalCents: v.optional(v.number()),
    purchasedAt: v.optional(v.number()),
  },
  handler: async (ctx, { receiptId, ...fields }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) {
      throw new Error("Receipt not found");
    }
    await ctx.db.patch(receiptId, fields);
  },
});

// Replace the per-receipt roster, cleaning up exclusions for anyone removed.
export const setRoster = mutation({
  args: { receiptId: v.id("receipts"), memberIds: v.array(v.id("members")) },
  handler: async (ctx, { receiptId, memberIds }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) {
      throw new Error("Receipt not found");
    }

    const next = new Set(memberIds);
    const existing = await ctx.db
      .query("receiptMembers")
      .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
      .collect();
    const current = new Set(existing.map((r) => r.memberId));

    // Remove dropped members + their exclusions on this receipt.
    for (const row of existing) {
      if (!next.has(row.memberId)) await ctx.db.delete(row._id);
    }
    const exclusions = await ctx.db
      .query("itemExclusions")
      .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
      .collect();
    for (const ex of exclusions) {
      if (!next.has(ex.memberId)) await ctx.db.delete(ex._id);
    }

    // Add newly included members.
    for (const memberId of memberIds) {
      if (!current.has(memberId)) {
        await ctx.db.insert("receiptMembers", { receiptId, memberId });
      }
    }
  },
});

// Delete a receipt and everything hanging off it.
// Immediate hard delete (used by the editor's Delete button, which confirms).
export const remove = mutation({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) {
      throw new Error("Receipt not found");
    }
    await cascadeDelete(ctx, receiptId);
  },
});

// Swipe delete: hide now, hard-delete in ~5s unless undone.
export const softDelete = mutation({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) {
      throw new Error("Receipt not found");
    }
    await ctx.db.patch(receiptId, { deletedAt: Date.now() });
    await ctx.scheduler.runAfter(5000, internal.receipts.purgeIfDeleted, {
      receiptId,
    });
  },
});

export const undoDelete = mutation({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.ownerUserId !== ownerUserId) return;
    await ctx.db.patch(receiptId, { deletedAt: undefined });
  },
});

// Scheduled after softDelete — only purges if it wasn't undone meanwhile.
export const purgeIfDeleted = internalMutation({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const receipt = await ctx.db.get(receiptId);
    if (receipt?.deletedAt) await cascadeDelete(ctx, receiptId);
  },
});
