"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createVertex } from "@ai-sdk/google-vertex";
import { generateObject } from "ai";
import { z } from "zod";

// GCP service-account JSON for Vertex (dedicated Evenly project).
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "{}");

const vertex = createVertex({
  project: serviceAccount.project_id,
  location: process.env.GOOGLE_VERTEX_LOCATION || "us-central1",
  googleAuthOptions: {
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  },
});

const MODEL = process.env.EXTRACT_MODEL || "gemini-2.5-flash";

// The model returns dollar amounts (what it reads); we convert to integer cents.
const ReceiptSchema = z.object({
  store: z.string().nullable().describe("store / merchant name, or null"),
  tax: z.number().describe("sales tax in dollars (0 if none)"),
  fees: z
    .number()
    .describe("other fees like bag or bottle deposit, in dollars (0 if none)"),
  discount: z
    .number()
    .describe("total discounts as a POSITIVE dollar amount (0 if none)"),
  total: z.number().nullable().describe("printed grand total in dollars, or null"),
  purchaseDate: z
    .string()
    .nullable()
    .describe(
      "purchase date printed on the receipt as YYYY-MM-DD, or null if not shown",
    ),
  items: z.array(
    z.object({
      name: z.string().describe("product name as printed"),
      quantity: z.number().nullable().describe("quantity if shown, else null"),
      lineTotal: z.number().describe("dollar amount charged for this line"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("0-1 confidence you read this line correctly"),
    }),
  ),
});

const PROMPT = `Extract the purchased line items from this grocery receipt or invoice (image or PDF).
Rules:
- "items" = only purchased products, each with the dollar amount actually charged for that line.
- Do NOT include subtotal, tax, fees, discounts, or the grand total in "items" — put those in their own fields.
- If a line has a per-item discount, use the net price charged.
- "purchaseDate" = the transaction date printed on the receipt, as YYYY-MM-DD (null if not shown).
- If the image is not a readable receipt, return an empty "items" array.`;

// Parse "YYYY-MM-DD" to a timestamp at noon UTC, so the calendar day is stable
// across timezones when displayed. Returns undefined if missing/unparseable.
function parsePurchaseDate(s: string | null): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(`${s.trim()}T12:00:00Z`);
  return Number.isNaN(t) ? undefined : t;
}

export const run = internalAction({
  args: { receiptId: v.id("receipts"), imageStorageId: v.id("_storage") },
  handler: async (ctx, { receiptId, imageStorageId }) => {
    try {
      const blob = await ctx.storage.get(imageStorageId);
      if (!blob) throw new Error("receipt file not found in storage");
      const bytes = new Uint8Array(await blob.arrayBuffer());

      // PDFs go to Gemini as a document part; images as an image part.
      const isPdf =
        blob.type === "application/pdf" ||
        (bytes[0] === 0x25 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x44 &&
          bytes[3] === 0x46); // "%PDF"
      const mediaPart = isPdf
        ? ({ type: "file", data: bytes, mediaType: "application/pdf" } as const)
        : ({
            type: "image",
            image: bytes,
            mediaType: blob.type || "image/jpeg",
          } as const);

      const { object } = await generateObject({
        model: vertex(MODEL),
        schema: ReceiptSchema,
        messages: [
          { role: "user", content: [{ type: "text", text: PROMPT }, mediaPart] },
        ],
      });

      const toCents = (d: number) => Math.round((d || 0) * 100);
      await ctx.runMutation(internal.receipts.applyExtraction, {
        receiptId,
        store: object.store ?? undefined,
        taxCents: toCents(object.tax),
        feesCents: toCents(object.fees),
        discountCents: toCents(object.discount),
        printedTotalCents:
          object.total != null ? toCents(object.total) : undefined,
        purchasedAt: parsePurchaseDate(object.purchaseDate),
        items: object.items.map((it) => ({
          name: it.name,
          quantity: it.quantity ?? undefined,
          lineTotalCents: toCents(it.lineTotal),
          needsReview: it.confidence < 0.6,
        })),
      });
    } catch (error) {
      console.error("Receipt extraction failed:", error);
      await ctx.runMutation(internal.receipts.markExtractionFailed, {
        receiptId,
      });
    }
  },
});
