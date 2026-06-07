// Run with: node --test convex/lib/split.test.ts   (Node 24 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplit, distribute, type SplitInput } from "./split.ts";

const names = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, id.toUpperCase()]));

test("distribute: $10.00 three ways → 334/333/333, sums exact", () => {
  const parts = distribute(1000, [1, 1, 1]);
  assert.deepEqual(parts, [334, 333, 333]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 1000);
});

test("distribute: proportional by weight, sums exact", () => {
  const parts = distribute(100, [700, 300]); // tax over subtotals
  assert.deepEqual(parts, [70, 30]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
});

test("distribute: all-zero weights → equal split, sums exact", () => {
  const parts = distribute(100, [0, 0, 0]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(parts, [34, 33, 33]);
});

test("computeSplit: per-item exclusion + proportional tax reconciles to the penny", () => {
  // Item A $6 shared by x,y; item B $4 for x only; tax $1.00.
  const input: SplitInput = {
    memberIds: ["x", "y"],
    memberNames: names(["x", "y"]),
    items: [
      { lineItemId: "a", name: "A", lineTotalCents: 600, includedMemberIds: ["x", "y"] },
      { lineItemId: "b", name: "B", lineTotalCents: 400, includedMemberIds: ["x"] },
    ],
    taxCents: 100,
    feesCents: 0,
    discountCents: 0,
  };
  const r = computeSplit(input);
  const x = r.perMember.find((m) => m.memberId === "x")!;
  const y = r.perMember.find((m) => m.memberId === "y")!;
  assert.equal(x.subtotalCents, 700); // 300 + 400
  assert.equal(y.subtotalCents, 300);
  assert.equal(x.taxShareCents, 70);
  assert.equal(y.taxShareCents, 30);
  assert.equal(x.totalCents, 770);
  assert.equal(y.totalCents, 330);
  assert.equal(r.grandTotalCents, 1100); // 600 + 400 + 100
  assert.equal(r.unallocatedCents, 0);
});

test("computeSplit: item excluded for everyone → unallocated, never absorbed", () => {
  const r = computeSplit({
    memberIds: ["x", "y"],
    memberNames: names(["x", "y"]),
    items: [
      { lineItemId: "a", name: "A", lineTotalCents: 500, includedMemberIds: [] },
    ],
    taxCents: 0,
    feesCents: 0,
    discountCents: 0,
  });
  assert.equal(r.unallocatedCents, 500);
  assert.equal(r.grandTotalCents, 0);
});

test("computeSplit: fees + discount, awkward cents, exact reconciliation", () => {
  const input: SplitInput = {
    memberIds: ["a", "b", "c"],
    memberNames: names(["a", "b", "c"]),
    items: [
      { lineItemId: "1", name: "Onions", lineTotalCents: 333, includedMemberIds: ["a", "b", "c"] },
      { lineItemId: "2", name: "Tomatoes", lineTotalCents: 777, includedMemberIds: ["a", "c"] },
      { lineItemId: "3", name: "Lemons", lineTotalCents: 101, includedMemberIds: ["b"] },
    ],
    taxCents: 89,
    feesCents: 25,
    discountCents: 50,
  };
  const r = computeSplit(input);
  const allocatedItems = 333 + 777 + 101;
  const expectedGrand = allocatedItems + 89 + 25 - 50;
  assert.equal(r.grandTotalCents, expectedGrand);
  // Every member's total equals the sum of its parts.
  for (const m of r.perMember) {
    assert.equal(
      m.totalCents,
      m.subtotalCents + m.taxShareCents + m.feesShareCents - m.discountShareCents,
    );
  }
  // Subtotals sum to allocated item cents.
  assert.equal(
    r.perMember.reduce((s, m) => s + m.subtotalCents, 0),
    allocatedItems,
  );
});

test("computeSplit: members sharing identical items land within 1 cent (no rounding bias)", () => {
  // a, b, c share every item; d is off the last one. a/b/c must not drift apart.
  const input: SplitInput = {
    memberIds: ["a", "b", "c", "d"],
    memberNames: names(["a", "b", "c", "d"]),
    items: [
      { lineItemId: "1", name: "Cumin", lineTotalCents: 450, includedMemberIds: ["a", "b", "c", "d"] },
      { lineItemId: "2", name: "Garam", lineTotalCents: 250, includedMemberIds: ["a", "b", "c", "d"] },
      { lineItemId: "3", name: "Onions", lineTotalCents: 750, includedMemberIds: ["a", "b", "c", "d"] },
      { lineItemId: "4", name: "Tomatoes", lineTotalCents: 677, includedMemberIds: ["a", "b", "c"] },
    ],
    taxCents: 43,
    feesCents: 0,
    discountCents: 0,
  };
  const r = computeSplit(input);
  const subs = ["a", "b", "c"].map(
    (id) => r.perMember.find((m) => m.memberId === id)!.subtotalCents,
  );
  const spread = Math.max(...subs) - Math.min(...subs);
  assert.ok(spread <= 1, `equal-share subtotals spread ${spread}c, expected <= 1`);
  assert.equal(r.grandTotalCents, 450 + 250 + 750 + 677 + 43);
});

test("computeSplit: $0 subtotal but tax present → tax splits equally", () => {
  const r = computeSplit({
    memberIds: ["a", "b"],
    memberNames: names(["a", "b"]),
    items: [],
    taxCents: 11,
    feesCents: 0,
    discountCents: 0,
  });
  assert.equal(r.perMember[0].taxShareCents + r.perMember[1].taxShareCents, 11);
  assert.equal(r.grandTotalCents, 11);
});
