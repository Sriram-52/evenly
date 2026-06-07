import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Money is integer cents EVERYWHERE in the data model and split math. The only
// place we divide by 100 is when rendering "$d.dd" in the UI. The Better Auth
// component owns the auth tables (users/sessions/accounts) via its own schema;
// these are the app tables. Everything is scoped to the single admin via
// `ownerUserId` (the Better Auth user id, i.e. the JWT `sub`).
export default defineSchema({
  // Roommates. Soft-deleted (isArchived) rather than removed, so historical
  // receipts that reference a member still resolve their name.
  members: defineTable({
    ownerUserId: v.string(),
    name: v.string(),
    zelleHandle: v.optional(v.string()),
    phone: v.optional(v.string()),
    // The admin themselves, as a split participant. Auto-created, included in
    // every receipt's roster, and never billed (they paid).
    isSelf: v.optional(v.boolean()),
    isArchived: v.boolean(),
    createdAt: v.number(),
  }).index("by_owner", ["ownerUserId"]),

  // One grocery run. Subtotal is NEVER stored — it's always derived from the
  // line items. Tax/fees/discount are stored as positive cents (discount is
  // subtracted in the split). Status drives the editor UI.
  receipts: defineTable({
    ownerUserId: v.string(),
    store: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("draft"),
      v.literal("extracting"),
      v.literal("ready"),
      v.literal("extraction_failed"),
    ),
    taxCents: v.number(),
    feesCents: v.number(),
    discountCents: v.number(),
    printedTotalCents: v.optional(v.number()),
    // When the purchase actually happened (ms). Defaults to creation time.
    purchasedAt: v.optional(v.number()),
    // Set when the user manually marks the receipt collected/done. Separate
    // from `status` (which is for the AI-extraction lifecycle).
    settledAt: v.optional(v.number()),
    // Soft-delete: hidden from the list, hard-deleted ~5s later unless undone.
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerUserId"]),

  // A single line on a receipt. `lineTotalCents` is the source of truth for the
  // split (handles weighed produce where unit*qty wouldn't round cleanly).
  lineItems: defineTable({
    receiptId: v.id("receipts"),
    ownerUserId: v.string(),
    name: v.string(),
    unitPriceCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    lineTotalCents: v.number(),
    needsReview: v.boolean(),
    sortOrder: v.number(),
  }).index("by_receipt", ["receiptId"]),

  // Join table: the PRESENCE of a row means "this member is EXCLUDED from this
  // item". Default (no row) = everyone shares. One keyed insert/delete per
  // toggle — no read-modify-write of an array under the reactive client.
  itemExclusions: defineTable({
    receiptId: v.id("receipts"),
    lineItemId: v.id("lineItems"),
    memberId: v.id("members"),
  })
    .index("by_lineItem_member", ["lineItemId", "memberId"])
    .index("by_lineItem", ["lineItemId"])
    .index("by_member", ["memberId"])
    .index("by_receipt", ["receiptId"]),

  // Per-receipt roster: which members participate in this receipt at all.
  receiptMembers: defineTable({
    receiptId: v.id("receipts"),
    memberId: v.id("members"),
  })
    .index("by_receipt", ["receiptId"])
    .index("by_receipt_member", ["receiptId", "memberId"]),

  // Per-user feature entitlements — the seam for a future paywall. An absent row
  // means the free tier. `scanEnabled` gates AI receipt scanning (the only thing
  // that costs money: the Vertex/Gemini calls); manual entry is always free.
  entitlements: defineTable({
    ownerUserId: v.string(),
    scanEnabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerUserId"]),
});
