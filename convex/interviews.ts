import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  isInterviewParticipant,
  requireAuth,
  requireInterviewParticipant,
  requireInterviewer,
} from "./lib/auth";

const ALLOWED_STATUSES = ["completed", "succeeded", "failed"] as const;

export const getAllInterviews = query({
  handler: async (ctx) => {
    await requireInterviewer(ctx);
    return await ctx.db.query("interviews").collect();
  },
});

export const getMyInterviews = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", identity.subject))
      .collect();

    return interviews;
  },
});

export const getInterviewByStreamCallIdInternal = internalQuery({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interviews")
      .withIndex("by_stream_call_id", (q) => q.eq("streamCallId", args.streamCallId))
      .first();
  },
});

export const getInterviewByStreamCallId = query({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const interview = await ctx.db
      .query("interviews")
      .withIndex("by_stream_call_id", (q) => q.eq("streamCallId", args.streamCallId))
      .first();

    if (!interview) return null;
    if (!isInterviewParticipant(identity.subject, interview)) {
      throw new Error("Forbidden: not a participant in this interview");
    }

    return interview;
  },
});

export const canJoinMeeting = query({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const interview = await ctx.db
      .query("interviews")
      .withIndex("by_stream_call_id", (q) => q.eq("streamCallId", args.streamCallId))
      .first();

    if (!interview) {
      return { allowed: false as const, reason: "not_found" as const };
    }

    const isParticipant = isInterviewParticipant(identity.subject, interview);
    return {
      allowed: isParticipant,
      reason: isParticipant ? null : ("not_participant" as const),
      interview: isParticipant ? interview : null,
    };
  },
});

export const createInterview = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    status: v.string(),
    streamCallId: v.string(),
    candidateId: v.string(),
    interviewerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireInterviewer(ctx);

    if (!args.interviewerIds.includes(identity.subject)) {
      throw new Error("Forbidden: caller must be listed as an interviewer");
    }

    return await ctx.db.insert("interviews", {
      ...args,
    });
  },
});

export const updateInterviewStatus = mutation({
  args: {
    id: v.id("interviews"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const interview = await ctx.db.get(args.id);
    if (!interview) throw new Error("Interview not found");

    if (!ALLOWED_STATUSES.includes(args.status as (typeof ALLOWED_STATUSES)[number])) {
      throw new Error("Invalid status");
    }

    if (args.status === "completed") {
      await requireInterviewParticipant(ctx, interview);
    } else {
      await requireInterviewer(ctx);
      if (!interview.interviewerIds.includes(identity.subject)) {
        throw new Error("Forbidden: not an interviewer for this interview");
      }
    }

    return await ctx.db.patch(args.id, {
      status: args.status,
      ...(args.status === "completed" ? { endTime: Date.now() } : {}),
    });
  },
});
