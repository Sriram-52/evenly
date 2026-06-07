import type { Auth } from "convex/server";

// Single-admin app: every row is scoped to the signed-in Better Auth user.
// The user id is the JWT `sub`, surfaced by Convex as `identity.subject`.
export async function requireUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}
