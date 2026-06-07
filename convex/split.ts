import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/owner";
import { computeSplit, type SplitItem } from "./lib/split";
import type { Id } from "./_generated/dataModel";

// Load a receipt's full graph and assemble the pure split input.
async function buildSplit(
  ctx: QueryCtx,
  receiptId: Id<"receipts">,
  ownerUserId: string,
) {
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

  // Resolve roster member docs (skip any that were hard-deleted).
  const memberDocs = (
    await Promise.all(rosterRows.map((r) => ctx.db.get(r.memberId)))
  ).filter((m): m is NonNullable<typeof m> => m !== null);

  const memberIds = memberDocs.map((m) => m._id as string);
  const memberNames: Record<string, string> = {};
  const zelleHandles: Record<string, string | undefined> = {};
  const selfIds = new Set<string>();
  for (const m of memberDocs) {
    memberNames[m._id] = m.isSelf ? "You" : m.name;
    zelleHandles[m._id] = m.zelleHandle;
    if (m.isSelf) selfIds.add(m._id as string);
  }

  // lineItemId -> set of excluded member ids.
  const exclusions = await ctx.db
    .query("itemExclusions")
    .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
    .collect();
  const excludedByItem = new Map<string, Set<string>>();
  for (const ex of exclusions) {
    const key = ex.lineItemId as string;
    if (!excludedByItem.has(key)) excludedByItem.set(key, new Set());
    excludedByItem.get(key)!.add(ex.memberId as string);
  }

  const items: SplitItem[] = lineItems.map((item) => {
    const excluded = excludedByItem.get(item._id as string) ?? new Set();
    return {
      lineItemId: item._id as string,
      name: item.name,
      lineTotalCents: item.lineTotalCents,
      includedMemberIds: memberIds.filter((id) => !excluded.has(id)),
    };
  });

  const result = computeSplit({
    memberIds,
    memberNames,
    items,
    taxCents: receipt.taxCents,
    feesCents: receipt.feesCents,
    discountCents: receipt.discountCents,
  });

  return { receipt, result, zelleHandles, selfIds };
}

// Live per-member split for the editor preview.
export const compute = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const built = await buildSplit(ctx, receiptId, ownerUserId);
    return built?.result ?? null;
  },
});

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// Per-member copy/share text for collecting their amount.
export const shareText = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const ownerUserId = await requireUserId(ctx);
    const built = await buildSplit(ctx, receiptId, ownerUserId);
    if (!built) return null;

    const { receipt, result, zelleHandles, selfIds } = built;
    const header = receipt.store ? `${receipt.store} ` : "";

    // Don't bill yourself — only roommates are billed.
    return result.perMember
      .filter((m) => !selfIds.has(m.memberId))
      .map((m) => {
      const lines: string[] = [];
      lines.push(`${header}— your share`);
      lines.push("");
      for (const item of m.items) {
        lines.push(`${item.name}: ${formatCents(item.shareCents)}`);
      }
      lines.push("");
      lines.push(`Subtotal: ${formatCents(m.subtotalCents)}`);
      if (m.taxShareCents) lines.push(`Tax: ${formatCents(m.taxShareCents)}`);
      if (m.feesShareCents) lines.push(`Fees: ${formatCents(m.feesShareCents)}`);
      if (m.discountShareCents)
        lines.push(`Discount: -${formatCents(m.discountShareCents)}`);
      lines.push(`Total: ${formatCents(m.totalCents)}`);

      return {
        memberId: m.memberId,
        name: m.name,
        zelleHandle: zelleHandles[m.memberId],
        totalCents: m.totalCents,
        text: lines.join("\n"),
      };
    });
  },
});
