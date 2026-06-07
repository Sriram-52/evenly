import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Demo data for marketing screenshots. Fake roommates + receipts so no real PII
// appears. Seeds NON-destructively: real roommates are archived and real
// receipts are soft-hidden, then both are restored by `clear`. Run with
// `npx convex run demo:seed '{"ownerUserId":"..."}'` and undo with `demo:clear`.

const FAKE = ["Alex Kim", "Sam Lee", "Jordan Ray"];
const DEMO_TAG = "__demo__"; // stored in the unused `phone` field (never shown in UI)
// Sentinel `deletedAt` for real receipts we hide for the demo. Distinct from a
// genuine soft-delete (which stamps Date.now(), a huge value), so `clear` can
// tell our hidden receipts apart and bring exactly those back.
const DEMO_HIDDEN = 1;

const DAY = 24 * 60 * 60 * 1000;

type DemoReceipt = {
  store: string;
  daysAgo: number;
  feesCents: number;
  taxCents: number;
  items: { name: string; cents: number }[];
  // Exclusions as [itemIndex, fakeMemberIndex] pairs.
  exclusions?: [number, number][];
};

const RECEIPTS: DemoReceipt[] = [
  {
    store: "Trader Joe's",
    daysAgo: 0,
    feesCents: 10,
    taxCents: 0,
    items: [
      { name: "Bananas", cents: 199 },
      { name: "Avocados (4 ct)", cents: 516 },
      { name: "Oat Milk", cents: 349 },
      { name: "Chicken Thighs", cents: 874 },
      { name: "Roma Tomatoes", cents: 420 },
      { name: "Cold Brew Coffee", cents: 999 },
    ],
    // A story the screenshot tells: Jordan skips coffee, Sam the chicken.
    exclusions: [
      [5, 2],
      [3, 1],
    ],
  },
  {
    store: "Costco",
    daysAgo: 3,
    feesCents: 0,
    taxCents: 412,
    items: [
      { name: "Rotisserie Chicken", cents: 499 },
      { name: "Eggs (24 ct)", cents: 689 },
      { name: "Olive Oil (2 L)", cents: 1899 },
      { name: "Mixed Berries", cents: 799 },
      { name: "Paper Towels (12)", cents: 2199 },
    ],
  },
  {
    store: "Whole Foods",
    daysAgo: 7,
    feesCents: 0,
    taxCents: 137,
    items: [
      { name: "Sourdough Loaf", cents: 449 },
      { name: "Greek Yogurt", cents: 599 },
      { name: "Baby Spinach", cents: 379 },
      { name: "Salmon Fillet", cents: 1349 },
    ],
    exclusions: [[3, 0]], // Alex skips the salmon
  },
];

async function membersOf(ctx: MutationCtx, ownerUserId: string) {
  return ctx.db
    .query("members")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
    .collect();
}

async function receiptsOf(ctx: MutationCtx, ownerUserId: string) {
  return ctx.db
    .query("receipts")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
    .collect();
}

export const seed = internalMutation({
  args: { ownerUserId: v.string() },
  handler: async (ctx, { ownerUserId }) => {
    const existing = await membersOf(ctx, ownerUserId);

    // Hide real roommates; keep (or create) the "You" participant.
    let selfId: Id<"members"> | undefined;
    for (const m of existing) {
      if (m.isSelf) {
        selfId = m._id;
        if (m.isArchived) await ctx.db.patch(m._id, { isArchived: false });
      } else if (m.phone !== DEMO_TAG) {
        await ctx.db.patch(m._id, { isArchived: true });
      }
    }
    if (!selfId) {
      selfId = await ctx.db.insert("members", {
        ownerUserId,
        name: "You",
        isSelf: true,
        isArchived: false,
        createdAt: Date.now(),
      });
    }

    // Hide real receipts so the list shows only the clean demo set.
    for (const r of await receiptsOf(ctx, ownerUserId)) {
      if (r.deletedAt === undefined) {
        await ctx.db.patch(r._id, { deletedAt: DEMO_HIDDEN });
      }
    }

    // Fresh fake roommates (drop any from a previous seed first).
    for (const m of existing) {
      if (m.phone === DEMO_TAG || m.zelleHandle === DEMO_TAG) {
        await ctx.db.delete(m._id);
      }
    }
    const fakeIds: Id<"members">[] = [];
    for (const name of FAKE) {
      fakeIds.push(
        await ctx.db.insert("members", {
          ownerUserId,
          name,
          phone: DEMO_TAG,
          isArchived: false,
          createdAt: Date.now(),
        }),
      );
    }

    const now = Date.now();
    let made = 0;
    for (const spec of RECEIPTS) {
      const purchasedAt = now - spec.daysAgo * DAY;
      const receiptId = await ctx.db.insert("receipts", {
        ownerUserId,
        store: spec.store,
        status: "ready",
        taxCents: spec.taxCents,
        feesCents: spec.feesCents,
        discountCents: 0,
        purchasedAt,
        createdAt: purchasedAt,
      });
      const itemIds: Id<"lineItems">[] = [];
      let sortOrder = 0;
      for (const it of spec.items) {
        itemIds.push(
          await ctx.db.insert("lineItems", {
            receiptId,
            ownerUserId,
            name: it.name,
            lineTotalCents: it.cents,
            needsReview: false,
            sortOrder: sortOrder++,
          }),
        );
      }
      for (const memberId of [selfId, ...fakeIds]) {
        await ctx.db.insert("receiptMembers", { receiptId, memberId });
      }
      for (const [itemIdx, fakeIdx] of spec.exclusions ?? []) {
        await ctx.db.insert("itemExclusions", {
          receiptId,
          lineItemId: itemIds[itemIdx],
          memberId: fakeIds[fakeIdx],
        });
      }
      made++;
    }

    return { receipts: made, fake: fakeIds.length };
  },
});

export const clear = internalMutation({
  args: { ownerUserId: v.string() },
  handler: async (ctx, { ownerUserId }) => {
    const members = await membersOf(ctx, ownerUserId);
    const fakeIds = new Set(
      members
        .filter((m) => m.phone === DEMO_TAG || m.zelleHandle === DEMO_TAG)
        .map((m) => m._id),
    );

    // Delete any receipt whose roster includes a demo member, with its rows.
    const rosters = await ctx.db.query("receiptMembers").collect();
    const demoReceiptIds = new Set(
      rosters.filter((r) => fakeIds.has(r.memberId)).map((r) => r.receiptId),
    );
    for (const receiptId of demoReceiptIds) {
      for (const table of ["lineItems", "itemExclusions", "receiptMembers"] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
          .collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
      const r = await ctx.db.get(receiptId);
      if (r?.imageStorageId) await ctx.storage.delete(r.imageStorageId);
      await ctx.db.delete(receiptId);
    }

    // Un-hide the real receipts we soft-hid during seed.
    let restoredReceipts = 0;
    for (const r of await receiptsOf(ctx, ownerUserId)) {
      if (r.deletedAt === DEMO_HIDDEN) {
        await ctx.db.patch(r._id, { deletedAt: undefined });
        restoredReceipts++;
      }
    }

    // Remove fakes, restore the real roommates.
    for (const id of fakeIds) await ctx.db.delete(id);
    for (const m of members) {
      if (!fakeIds.has(m._id) && m.isArchived && !m.isSelf) {
        await ctx.db.patch(m._id, { isArchived: false });
      }
    }
    return {
      restoredMembers: members.length - fakeIds.size,
      restoredReceipts,
    };
  },
});
