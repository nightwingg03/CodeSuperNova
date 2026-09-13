import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireAuth(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity;
}

export async function getCurrentUser(ctx: AuthCtx) {
  const identity = await requireAuth(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return { identity, user };
}

export async function requireInterviewer(ctx: AuthCtx) {
  const { identity, user } = await getCurrentUser(ctx);
  if (user.role !== "interviewer") throw new Error("Forbidden: interviewer role required");
  return { identity, user };
}

export function isInterviewParticipant(
  clerkId: string,
  interview: Doc<"interviews">
) {
  return (
    clerkId === interview.candidateId ||
    interview.interviewerIds.includes(clerkId)
  );
}

export async function requireInterviewParticipant(
  ctx: AuthCtx,
  interview: Doc<"interviews">
) {
  const identity = await requireAuth(ctx);
  if (!isInterviewParticipant(identity.subject, interview)) {
    throw new Error("Forbidden: not a participant in this interview");
  }
  return identity;
}
