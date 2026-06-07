// Pure split math. NO floats, NO Convex imports — just integer cents in,
// integer cents out, so it's trivially unit-testable and provably exact.
//
// The one invariant the whole app leans on: every distribution uses the
// largest-remainder method, so the parts sum EXACTLY to the pool. Therefore
// `sum(perMember.totalCents) === allocatedItemCents + tax + fees - discount`
// to the penny — no lost or invented cents.

export type SplitItem = {
  lineItemId: string;
  name: string;
  lineTotalCents: number;
  /** Members who share this item (everyone minus the excluded). */
  includedMemberIds: string[];
};

export type SplitInput = {
  /** Full roster for the receipt. */
  memberIds: string[];
  memberNames: Record<string, string>;
  items: SplitItem[];
  taxCents: number;
  feesCents: number;
  /** Positive cents; subtracted from each member's share. */
  discountCents: number;
};

export type MemberItemShare = {
  lineItemId: string;
  name: string;
  shareCents: number;
};

export type MemberSplit = {
  memberId: string;
  name: string;
  subtotalCents: number;
  taxShareCents: number;
  feesShareCents: number;
  discountShareCents: number;
  totalCents: number;
  items: MemberItemShare[];
};

export type SplitResult = {
  perMember: MemberSplit[];
  grandTotalCents: number;
  /** Cost of items that ended up with no included members. Surfaced as a
   *  warning — the split is short by exactly this much, never silently absorbed. */
  unallocatedCents: number;
};

/**
 * Distribute `amount` cents across `weights` proportionally, using the
 * largest-remainder method so the returned parts sum EXACTLY to `amount`.
 * - All-zero weights → split equally (used for tax on a $0 subtotal).
 * - Deterministic tie-break by index, so results are stable across runs.
 * `amount` is assumed non-negative (discount is handled as a positive pool).
 */
export function distribute(amount: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (amount === 0) return weights.map(() => 0);

  let w = weights;
  let totalWeight = weights.reduce((s, x) => s + x, 0);
  if (totalWeight === 0) {
    w = weights.map(() => 1);
    totalWeight = n;
  }

  const base = new Array<number>(n);
  const remainder = new Array<number>(n);
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const numerator = amount * w[i];
    base[i] = Math.floor(numerator / totalWeight);
    remainder[i] = numerator - base[i] * totalWeight; // numerator % totalWeight
    allocated += base[i];
  }

  // leftover is < n by construction (sum of floors). Hand one extra cent to the
  // largest remainders, ties broken by lower index.
  const leftover = amount - allocated;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    remainder[b] !== remainder[a] ? remainder[b] - remainder[a] : a - b,
  );
  const result = base.slice();
  for (let k = 0; k < leftover; k++) result[order[k]] += 1;
  return result;
}

export function computeSplit(input: SplitInput): SplitResult {
  const { memberIds, memberNames, items, taxCents, feesCents, discountCents } =
    input;

  const roster = new Set(memberIds);
  const subtotal: Record<string, number> = {};
  const itemShares: Record<string, MemberItemShare[]> = {};
  for (const id of memberIds) {
    subtotal[id] = 0;
    itemShares[id] = [];
  }

  let unallocatedCents = 0;

  // Step A — split each item equally among its included members.
  //
  // The leftover cent(s) from an uneven split go to the FIRST members of the
  // ordering. If that ordering were the same every item, the same people would
  // always absorb the extra cent and drift ahead — so members who shared the
  // exact same items could end up several cents apart. We rotate the ordering
  // by the item's index so the leftover cents spread evenly; equal-share members
  // then land within a single cent of each other.
  items.forEach((item, idx) => {
    const included = item.includedMemberIds.filter((id) => roster.has(id));
    if (included.length === 0) {
      unallocatedCents += item.lineTotalCents;
      return;
    }
    const sorted = [...included].sort();
    const offset = idx % sorted.length;
    const order = [...sorted.slice(offset), ...sorted.slice(0, offset)];
    const shares = distribute(
      item.lineTotalCents,
      order.map(() => 1),
    );
    order.forEach((id, i) => {
      subtotal[id] += shares[i];
      if (shares[i] !== 0) {
        itemShares[id].push({
          lineItemId: item.lineItemId,
          name: item.name,
          shareCents: shares[i],
        });
      }
    });
  });

  // Step B — allocate tax/fees/discount proportionally to each member's
  // subtotal (largest-remainder). On a $0 subtotal these fall back to equal.
  const weights = memberIds.map((id) => subtotal[id]);
  const taxShares = distribute(taxCents, weights);
  const feesShares = distribute(feesCents, weights);
  const discountShares = distribute(discountCents, weights);

  // Step C — assemble. Every step summed exactly, so the grand total reconciles.
  const perMember: MemberSplit[] = memberIds.map((id, i) => {
    const sub = subtotal[id];
    const total = sub + taxShares[i] + feesShares[i] - discountShares[i];
    return {
      memberId: id,
      name: memberNames[id] ?? "Unknown",
      subtotalCents: sub,
      taxShareCents: taxShares[i],
      feesShareCents: feesShares[i],
      discountShareCents: discountShares[i],
      totalCents: total,
      items: itemShares[id],
    };
  });

  const grandTotalCents = perMember.reduce((s, m) => s + m.totalCents, 0);
  return { perMember, grandTotalCents, unallocatedCents };
}
