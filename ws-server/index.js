import { Server } from "@hocuspocus/server";
import { verifyToken } from "@clerk/backend";

const PORT = parseInt(process.env.PORT || "1234", 10);
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;
const WS_SERVER_SECRET = process.env.WS_SERVER_SECRET;

if (!CLERK_SECRET_KEY || !CONVEX_SITE_URL || !WS_SERVER_SECRET) {
  console.error(
    "Missing required env vars: CLERK_SECRET_KEY, CONVEX_SITE_URL, WS_SERVER_SECRET"
  );
  process.exit(1);
}

async function verifyParticipant(clerkId, streamCallId) {
  const response = await fetch(`${CONVEX_SITE_URL}/verify-meeting-participant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WS_SERVER_SECRET}`,
    },
    body: JSON.stringify({ clerkId, streamCallId }),
  });

  if (!response.ok) {
    throw new Error(`Participant verification failed: ${response.status}`);
  }

  const data = await response.json();
  return data.allowed === true;
}

const server = Server.configure({
  port: PORT,

  async onAuthenticate({ token, documentName }) {
    if (!token) {
      throw new Error("Missing authentication token");
    }

    const verified = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    });

    const clerkId = verified.sub;
    if (!clerkId) {
      throw new Error("Invalid token");
    }

    const allowed = await verifyParticipant(clerkId, documentName);
    if (!allowed) {
      throw new Error("Not authorized to join this meeting room");
    }

    return { user: { id: clerkId } };
  },
});

server.listen();
console.log(`Hocuspocus WebSocket server listening on port ${PORT}`);
