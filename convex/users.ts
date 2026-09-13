import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireInterviewer } from "./lib/auth";

export const syncUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) return;

    return await ctx.db.insert("users", {
      ...args,
      role: "candidate",
    });
  },
});

export const getUsers = query({
  handler: async (ctx) => {
    await requireInterviewer(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    return user;
  },
});

export const promoteToInterviewer = mutation({
  args: { targetClerkId: v.string() },
  handler: async (ctx, args) => {
    await requireInterviewer(ctx);

    const target = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.targetClerkId))
      .first();

    if (!target) throw new Error("User not found");
    if (target.role === "interviewer") throw new Error("User is already an interviewer");

    await ctx.db.patch(target._id, { role: "interviewer" });
  },
});
