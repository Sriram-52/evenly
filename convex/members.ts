import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/owner";

// All active members the user owns — INCLUDING the "self" participant (the
// editor renders it as a toggleable "You" chip). The Roommates tab filters out
// `isSelf` since it's not a roommate.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerUserId = await requireUserId(ctx);
    const members = await ctx.db
      .query("members")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .collect();
    return members.filter((m) => !m.isArchived);
  },
});

// Ensure the admin's "self" participant exists (so it can appear as a toggle).
// Does NOT touch any roster — inclusion is optional, per receipt.
export const ensureSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ensureSelfMember(
      ctx,
      identity.subject,
      identity.name?.trim() || "You",
    );
  },
});

// Get (or lazily create) the admin's own "self" participant — included in every
// split so the payer covers their own share, but never billed.
export async function ensureSelfMember(
  ctx: MutationCtx,
  ownerUserId: string,
  displayName: string,
): Promise<Id<"members">> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
    .collect();
  const self = members.find((m) => m.isSelf);
  if (self) return self._id;
  return ctx.db.insert("members", {
    ownerUserId,
    name: displayName,
    isSelf: true,
    isArchived: false,
    createdAt: Date.now(),
  });
}

export const add = mutation({
  args: {
    name: v.string(),
    zelleHandle: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerUserId = await requireUserId(ctx);
    return ctx.db.insert("members", {
      ownerUserId,
      name: args.name,
      zelleHandle: args.zelleHandle,
      phone: args.phone,
      isArchived: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    memberId: v.id("members"),
    name: v.optional(v.string()),
    zelleHandle: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { memberId, ...fields }) => {
    const ownerUserId = await requireUserId(ctx);
    const member = await ctx.db.get(memberId);
    if (!member || member.ownerUserId !== ownerUserId) {
      throw new Error("Member not found");
    }
    await ctx.db.patch(memberId, fields);
  },
});

// Undo an archive (used by the Roommates swipe-delete undo).
export const unarchive = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const ownerUserId = await requireUserId(ctx);
    const member = await ctx.db.get(memberId);
    if (!member || member.ownerUserId !== ownerUserId) return;
    await ctx.db.patch(memberId, { isArchived: false });
  },
});

// Soft delete: keep the row so finalized/older receipts still resolve the name,
// but drop it from the active roster everywhere.
export const archive = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const ownerUserId = await requireUserId(ctx);
    const member = await ctx.db.get(memberId);
    if (!member || member.ownerUserId !== ownerUserId) {
      throw new Error("Member not found");
    }
    await ctx.db.patch(memberId, { isArchived: true });

    // Remove from current rosters + clear their exclusions on those receipts.
    const exclusions = await ctx.db
      .query("itemExclusions")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .collect();
    for (const ex of exclusions) await ctx.db.delete(ex._id);

    const rosterRows = await ctx.db
      .query("receiptMembers")
      .filter((q) => q.eq(q.field("memberId"), memberId))
      .collect();
    for (const row of rosterRows) await ctx.db.delete(row._id);
  },
});
