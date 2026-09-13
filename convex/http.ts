import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { isInterviewParticipant } from "./lib/auth";

const http = httpRouter();

http.route({
  path: "/verify-meeting-participant",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const wsSecret = process.env.WS_SERVER_SECRET;
    if (!wsSecret) {
      return new Response("Missing WS_SERVER_SECRET", { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${wsSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { clerkId, streamCallId } = body as {
      clerkId?: string;
      streamCallId?: string;
    };

    if (!clerkId || !streamCallId) {
      return new Response("Missing clerkId or streamCallId", { status: 400 });
    }

    const interview = await ctx.runQuery(internal.interviews.getInterviewByStreamCallIdInternal, {
      streamCallId,
    });

    if (!interview) {
      return new Response(JSON.stringify({ allowed: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowed = isInterviewParticipant(clerkId, interview);
    return new Response(JSON.stringify({ allowed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
    }

    const svix_id = request.headers.get("svix-id");
    const svix_signature = request.headers.get("svix-signature");
    const svix_timestamp = request.headers.get("svix-timestamp");

    if (!svix_id || !svix_signature || !svix_timestamp) {
      return new Response("No svix headers found", {
        status: 400,
      });
    }

    const payload = await request.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(webhookSecret);
    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new Response("Error occurred", { status: 400 });
    }

    const eventType = evt.type;

    if (eventType === "user.created") {
      const { id, email_addresses, first_name, last_name, image_url } = evt.data;

      const email = email_addresses[0].email_address;
      const name = `${first_name || ""} ${last_name || ""}`.trim();

      try {
        await ctx.runMutation(internal.users.syncUser, {
          clerkId: id,
          email,
          name,
          image: image_url,
        });
      } catch (error) {
        console.log("Error creating user:", error);
        return new Response("Error creating user", { status: 500 });
      }
    }

    return new Response("Webhook processed successfully", { status: 200 });
  }),
});

export default http;
