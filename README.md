<h1 align="center">CodeSuperNova</h1>

<p align="center">Remote technical interviews with live video and real-time collaborative coding.</p>



## Overview

CodeSuperNova is a full-stack interview platform where interviewers and candidates join the same video room and edit code together in real time. It extends the original CodeSync-style architecture with **Yjs-based collaborative editing**, **WebSocket sync**, and **security hardening** across auth, meetings, and the dashboard.

## Features

### Video & meetings
- Live video calls via [Stream Video SDK](https://getstream.io/video/)
- Screen sharing and call recording
- Meeting lobby with camera/mic preview
- Schedule interviews or start instant meetings
- Interviewer dashboard for upcoming/past interviews

### Real-time collaborative code editor
- **Monaco Editor** for in-browser coding (JavaScript, Python, Java)
- **Yjs CRDT** shared document per meeting room
- **y-monaco** binding so typing syncs instantly between participants
- **Hocuspocus WebSocket server** (`ws-server/`) for document sync
- Shared **question** and **language** selection synced across both users
- Room ID matches the Stream call ID so video and code stay in the same session

### Auth & security
- **Clerk** authentication (sign-in, JWT, webhooks)
- **Convex** backend with role-based access (`candidate` / `interviewer`)
- Route protection for `/dashboard` and `/schedule` (middleware + layout guards)
- Meeting join checks via `canJoinMeeting` before entering a call
- WebSocket auth: Clerk JWT + Convex participant verification
- Interviewer-only admin actions (promote users, view team, schedule interviews)

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, TypeScript, Tailwind, Shadcn UI |
| Auth | Clerk |
| Database / API | Convex (queries, mutations, HTTP actions) |
| Video | Stream Video SDK + Server Actions for user tokens |
| Collaborative editor | Yjs, y-websocket, y-monaco, Monaco Editor |
| Sync server | Hocuspocus (`ws-server/`) |

## Architecture

```
Browser (Next.js)
├── Clerk          → login, session, JWT
├── Convex         → users, interviews, comments, access control
├── Stream         → video calls (token via Server Action)
└── ws-server      → Yjs document sync (room = streamCallId)
        ↑
   Clerk JWT + Convex participant check
```

**Collaborative editing flow**
1. User joins `/meeting/[streamCallId]`
2. `useCollaborativeEditor` creates a `Y.Doc` and connects to `NEXT_PUBLIC_WS_URL`
3. Code lives in `Y.Text("monaco")`; question/language in `Y.Map("meta")`
4. `MonacoBinding` links Monaco ↔ Yjs; updates broadcast to all clients in the room

## Getting started

### Prerequisites
- Node.js 18+
- Accounts for [Clerk](https://clerk.com), [Convex](https://convex.dev), and [Stream](https://getstream.io)

### 1. Clone and install

```bash
git clone https://github.com/nightwingg03/CodeSuperNova.git
cd CodeSuperNova
npm install
cd ws-server && npm install && cd ..
```

### 2. Environment variables

Create `.env.local` in the project root:

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Stream Video
NEXT_PUBLIC_STREAM_API_KEY=
STREAM_SECRET_KEY=

# Collaborative editor
NEXT_PUBLIC_WS_URL=ws://localhost:1234
WS_SERVER_SECRET=your-random-secret
```

In the **Convex dashboard** (Settings → Environment Variables), set:
- `CLERK_WEBHOOK_SECRET` — from Clerk webhook settings
- `WS_SERVER_SECRET` — same value as in `.env.local`

Update `convex/auth.config.ts` with **your** Clerk JWT issuer domain.

For the WebSocket server, create `ws-server/.env` (or export vars):

```bash
CLERK_SECRET_KEY=
CONVEX_SITE_URL=https://your-deployment.convex.site
WS_SERVER_SECRET=
PORT=1234
```

### 3. Convex & Clerk setup
- Run `npx convex dev` and link your deployment
- Add Clerk webhook → `https://<your-deployment>.convex.site/clerk-webhook` (event: `user.created`)
- Promote your first interviewer manually in the Convex `users` table (`role: "interviewer"`)

### 4. Run locally

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — WebSocket server (required for live code sync)
npm run dev:ws
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/                    # Next.js App Router (home, schedule, meeting, dashboard)
├── components/             # UI, MeetingRoom, CodeEditor, providers
├── hooks/                  # useCollaborativeEditor, useMeetingActions, etc.
├── actions/                # stream.actions.ts (Stream user tokens)
└── constants/              # branding, coding questions, languages

convex/                     # Backend schema, interviews, users, HTTP routes
ws-server/                  # Hocuspocus server for Yjs sync
```

## Key scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:ws` | Start collaborative editor WebSocket server |
| `npm run build` | Production build |
| `npx convex dev` | Run Convex backend locally |

## Branding (optional)

- **Clerk Dashboard** → Branding: application name `CodeSuperNova`, custom logo
- **Stream / Convex dashboards**: rename projects for your organization

## Credits

Built on concepts from the CodeSync remote interview platform. Collaborative editing and security enhancements added for CodeSuperNova.

## License

See [LICENSE](LICENSE).
