# ION LDP — Face-to-Face Technical Interview Prep (CodeSuperNova)

> **Your project:** **CodeSuperNova** (npm package `codesync`) — remote technical interviews with Stream video, Convex backend, Clerk auth, and **Yjs + Hocuspocus** collaborative coding.
>
> **Role:** ION Group **Leadership Development Program (LDP)** — Software Developer (and related tech tracks). ION builds **FinTech / trading / workflow software** for banks and enterprises. They care about **problem-solving, honesty, communication, teamwork**, and **deep understanding of what you built** — not buzzwords.
>
> **How to use this doc:** (1) Memorize the **elevator pitch** and **whiteboard diagrams**. (2) Read **Part 2–4** until you can explain each box without notes. (3) Practice **Part 8 Q&A** out loud. (4) Keep **Part 9 cheat sheet** open on interview day. For even more file-level detail, see `INTERVIEW_PREP.md`.

---

## Table of contents

1. [What ION is looking for](#part-1--what-ion-is-looking-for)
2. [Whiteboard architecture (draw this)](#part-2--whiteboard-architecture-draw-this)
3. [Glossary — APIs, HTTP, real-time, databases](#part-3--glossary--apis-http-real-time-databases)
4. [Request lifecycle in *your* app](#part-4--request-lifecycle-in-your-app)
5. [Tech stack — why this, why not that](#part-5--tech-stack--why-this-why-not-that)
6. [Data model & “queries” (Convex)](#part-6--data-model--queries-convex)
7. [Security & access control story](#part-7--security--access-control-story)
8. [Interview Q&A (ION-relevant)](#part-8--interview-qa-ion-relevant)
9. [Cheat sheet & red flags](#part-9--cheat-sheet--red-flags)
10. [Beyond your project — ION-style CS topics](#part-10--beyond-your-project--ion-style-cs-topics)

---

# Part 1 — What ION is looking for

## Typical LDP process (varies by region)

| Stage | What to expect |
|--------|----------------|
| Online application | Verbal/numerical reasoning tests (often within a few days of invite) |
| Video / early rounds | Background, motivation, **Why ION?**, interest in **finance + technology** |
| Technical round (~1 hr) | **Resume/project deep dive**, CS fundamentals (DBMS, OOP, networks, OS), **medium DSA**, sometimes **OOP system design** (e.g. taxi/booking class diagram) |
| Assessment day | **Case study** (structure + communicate under time), **group exercise** (collaboration, not dominating), more interviews |

**What interviewers said publicly (Glassdoor / experiences):** be **honest** about what you know and don’t know; they like candidates who **challenge thoughtfully** and show genuine **FinTech interest**.

## How to connect your project to ION

You are not building a trading engine — but you *are* building **mission-critical collaboration software** with:

- **Low-latency real-time sync** (Yjs over WebSockets) — analogous mindset to market data / live UIs
- **Strong access control** (roles, participant checks, signed webhooks) — banks care about **authorization**
- **Multiple integrated services** — same integration discipline as enterprise products
- **End-to-end ownership** — schedule → live session → post-interview outcome

**30-second pitch (memorize):**

> “I built CodeSuperNova, a remote technical interview platform. Interviewers schedule candidates, both join a **video call** and a **shared code editor** that syncs in real time. I used **Next.js** for the UI, **Clerk** for authentication, **Convex** for interviews and roles, **Stream** for WebRTC video, and a **Hocuspocus WebSocket server** with **Yjs CRDTs** for collaborative editing. Security is layered: middleware, Convex auth helpers, `canJoinMeeting` before video join, and the WS server re-checks participants via Convex HTTP.”

**2-minute version:** expand with one user journey (schedule → join → type in editor → end call → pass/fail on dashboard) and one **trade-off** (Convex vs custom REST API; Stream vs raw WebRTC).

**Why ION? (frame honestly):**

- Global **FinTech** product company — software directly used by **tier-1 banks**
- **LDP** = breadth + rotations + leadership exposure, not just one team
- You want to ship **reliable, secure, real-time** systems at scale — your project is a deliberate step toward that

---

# Part 2 — Whiteboard architecture (draw this)

## Diagram A — System context (boxes + arrows)

Draw **one browser**, then **four external systems** + **one custom server**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js 14)                      │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │ React UI     │  │ Clerk SDK   │  │ Stream Video React SDK   │ │
│  │ Monaco+Yjs   │  │ session/JWT │  │ call.join(), controls    │ │
│  └──────┬───────┘  └──────┬──────┘  └────────────┬─────────────┘ │
│         │                 │                       │               │
│         │ useQuery/       │ JWT on Convex + WS    │ token from    │
│         │ useMutation     │                       │ Server Action │
└─────────┼─────────────────┼───────────────────────┼───────────────┘
          │                 │                       │
          v                 v                       v
   ┌──────────────┐  ┌──────────────┐        ┌──────────────┐
   │   Convex     │  │    Clerk     │        │ Stream Cloud │
   │ DB + funcs   │  │ Auth + hooks │        │ WebRTC video │
   │ + HTTP       │  └──────┬───────┘        └──────────────┘
   └──────▲───────┘         │ webhook (Svix)
          │                 v
          │          POST /clerk-webhook
          │
   ┌──────┴───────┐
   │  ws-server   │  Hocuspocus (port 1234)
   │  (Node.js)   │  Yjs document per room = streamCallId
   └──────▲───────┘
          │ WebSocket + Clerk JWT
          │ then POST /verify-meeting-participant (Bearer secret)
          └──────────────────────────────────────────► Convex HTTP
```

**One sentence while drawing:** “The browser talks to Convex for **interview data**, Clerk for **identity**, Stream for **video**, and our **ws-server** only for **code sync**; Convex is the source of truth for who may join.”

## Diagram B — Interview lifecycle (state)

```
[upcoming] ──(time window, client)──► [live] ──end call──► [completed] ──dashboard──► [succeeded | failed]
     ▲                                      │
     └── created by createInterview         └── updateInterviewStatus("completed")
```

- **`live` is not stored in DB** — computed in `getMeetingStatus()` (`src/lib/utils.ts`) from `startTime` and a 1-hour window.
- Only **`completed` / `succeeded` / `failed`** are written via `updateInterviewStatus` (with auth rules).

## Diagram C — Join meeting sequence (great for “walk me through a request”)

```
Candidate          Next.js page          Convex              Stream           ws-server
    |                  |                    |                  |                  |
    |-- open /meeting/id ----------------->|                  |                  |
    |                  |-- canJoinMeeting ->|                  |                  |
    |                  |<-- allowed --------|                  |                  |
    |                  |-- useGetCallById --------------------->|                  |
    |-- Join click ----|                    |                  |                  |
    |                  |-------------------- call.join() ------>|                  |
    |                  |-- Yjs WS connect ---------------------------------------->|
    |                  |                    |<-- verify participant (HTTP) -------|
    |                  |                    |                  |                  |
    |<=========== video + synced code =================================================|
```

## Diagram D — Inside the meeting room UI

```
┌────────────────────────────────────────────────────────────┐
│  MeetingRoom (react-resizable-panels)                       │
│  ┌─────────────────┬────────────────────────────────────┐ │
│  │ Video ~35%      │ CodeEditor ~65%                     │ │
│  │ SpeakerLayout   │  Question panel (Y.Map meta)        │ │
│  │ CallControls    │  Monaco ◄──► Y.Text via y-monaco    │ │
│  │ EndCallButton   │                                       │ │
│  └─────────────────┴────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Key ID:** `streamCallId` = Stream `call.id` = Yjs **room name** = URL `/meeting/[id]`.

---

# Part 3 — Glossary — APIs, HTTP, real-time, databases

| Term | Plain English | In CodeSuperNova |
|------|----------------|------------------|
| **REST API** | HTTP resources identified by URLs; verbs GET/POST/PATCH/DELETE; often JSON bodies | Convex **HTTP routes** in `convex/http.ts` behave like small REST endpoints (`POST /clerk-webhook`, `POST /verify-meeting-participant`). Most app “API” is **Convex queries/mutations**, not REST |
| **Endpoint** | A URL + method the client calls | e.g. `https://<deployment>.convex.site/clerk-webhook` |
| **Request** | Method + URL + headers + optional body | Browser → Convex via WebSocket protocol; ws-server → Convex via `fetch` POST |
| **Response** | Status code + headers + body | `200` + `{ "allowed": true }` from participant verify |
| **Status code** | 2xx success, 4xx client error, 5xx server error | `401` wrong WS secret; `400` bad webhook signature |
| **Header** | Metadata (`Authorization`, `Content-Type`) | `Authorization: Bearer <WS_SERVER_SECRET>` |
| **JSON** | Text format for structured data | Webhook payload; verify body `{ clerkId, streamCallId }` |
| **JWT** | Signed token; claims like `sub` = user id | Clerk JWT → Convex `getUserIdentity()`; same token to ws-server |
| **Webhook** | Server A notifies server B on events (HTTP POST) | Clerk `user.created` → Convex creates user |
| **Query (read)** | Fetch data without changing server state | Convex `query` — e.g. `getMyInterviews` |
| **Mutation (write)** | Change data | Convex `mutation` — e.g. `createInterview` |
| **Subscription / real-time** | Server pushes updates when data changes | `useQuery` keeps a live Convex subscription |
| **WebSocket** | Persistent bidirectional TCP connection | Yjs sync via `y-websocket` to Hocuspocus |
| **WebRTC** | Browser peer media (audio/video) | Used **inside Stream SDK**, not hand-rolled |
| **CRDT** | Data structure that merges concurrent edits safely | **Yjs** `Y.Text` for editor buffer |
| **BaaS** | Backend-as-a-Service — DB + API hosted | **Convex** |
| **RBAC** | Role-based access control | `candidate` vs `interviewer` in `users.role` |
| **Idempotency** | Repeating a request doesn’t duplicate effect | Webhook retries: `syncUser` should tolerate duplicate `user.created` (worth mentioning as improvement) |
| **Defense in depth** | Multiple independent security layers | Middleware + layout + Convex + WS auth |

### curl — examples tied to *your* HTTP API

**1. Participant verification (what ws-server calls)**

```bash
curl -s -X POST "https://YOUR_DEPLOYMENT.convex.site/verify-meeting-participant" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WS_SERVER_SECRET" \
  -d '{"clerkId":"user_2abc...","streamCallId":"550e8400-e29b-41d4-a716-446655440000"}'
```

Expected body: `{"allowed":true}` or `{"allowed":false}` with HTTP **200** (business logic in JSON, not always 403).

**2. Clerk webhook (you don’t curl this manually in prod)**

Clerk sends `POST` with **Svix** headers (`svix-id`, `svix-timestamp`, `svix-signature`). Your handler verifies with `CLERK_WEBHOOK_SECRET` before calling `internal.users.syncUser`.

**3. “REST” vs Convex from the browser**

The React app does **not** typically `curl` Convex. It calls:

```typescript
useQuery(api.interviews.canJoinMeeting, { streamCallId })
useMutation(api.interviews.createInterview)({ ... })
```

Convex client sends authenticated RPC over its **WebSocket** to the Convex cloud — think “API,” but not REST-shaped.

### REST API lifecycle (generic) — map to your webhook

| Step | REST example | Your project |
|------|----------------|--------------|
| 1. Client builds request | `POST /users` + JSON | Clerk builds signed webhook POST |
| 2. Transport | HTTPS | HTTPS to `.convex.site` |
| 3. Server authenticates | API key / OAuth | Svix signature verification |
| 4. Validate input | Schema | Check svix headers + parse `user.created` |
| 5. Business logic | Create user row | `internal.users.syncUser` → `role: "candidate"` |
| 6. Persist | SQL INSERT | Convex `db.insert("users", ...)` |
| 7. Response | `201` + body | `200` “Webhook processed successfully” |
| 8. Client handles | Update UI | User already signed in; Convex row appears for `useQuery` |

---

# Part 4 — Request lifecycle in your app

## Lifecycle 1 — Sign up

1. User signs up in **Clerk** UI.
2. Clerk fires **`user.created`** webhook → `POST /clerk-webhook`.
3. Convex verifies **Svix** signature → runs **`syncUser`** (`internalMutation` — **not** callable from browser).
4. User document: `role: "candidate"`, indexed by `clerkId`.

**Why internal mutation?** Prevents anyone from forging user records from the client — only trusted webhook path.

## Lifecycle 2 — Schedule interview (interviewer)

1. UI: `/schedule` — **middleware** `auth.protect()` + page checks `isInterviewer`.
2. Generate UUID → **Stream** `call.getOrCreate()` → get `streamCallId`.
3. **Mutation** `createInterview` — server checks `requireInterviewer` and caller ∈ `interviewerIds`.
4. Convex stores row; dashboard/home `useQuery` updates live.

## Lifecycle 3 — Join + collaborative edit

1. `canJoinMeeting({ streamCallId })` — `requireAuth` + participant = `candidateId` or `interviewerIds`.
2. Meeting page redirects if `!allowed`.
3. **Stream** `call.join()` after lobby (`MeetingSetup`).
4. `useCollaborativeEditor(roomId)`:
   - Creates `Y.Doc`, `Y.Text("monaco")`, `Y.Map("meta")`.
   - `WebsocketProvider(wsUrl, roomId, ydoc, { params: { token } })`.
5. **Hocuspocus** `onAuthenticate`: verify Clerk JWT → `verifyParticipant` → Convex HTTP.
6. **MonacoBinding** applies remote Yjs updates to the editor.

## Lifecycle 4 — End + evaluate

1. Owner ends Stream call + `updateInterviewStatus("completed")` — participant auth on server.
2. Interviewer sets `succeeded` / `failed` — must be interviewer on that interview.
3. `addComment` — stores rating + text (know the **gap**: weak role checks today — see Part 9).

---

# Part 5 — Tech stack — why this, why not that

| Choice | Pros for *your* goals | Cons / risks | Alternatives you considered |
|--------|------------------------|--------------|-----------------------------|
| **Next.js 14 App Router** | SSR/layouts, **Server Actions** hide Stream secret, file-based routes | Many client components for hooks/real-time | Vite SPA — you’d build auth API yourself |
| **TypeScript** | Safer refactors across UI + Convex | Build step | JavaScript — faster hack, worse at scale |
| **Convex** | Real-time `useQuery`, typed backend, no REST boilerplate | Vendor lock-in; not SQL | Express + PostgreSQL + Socket.io — more control, more code |
| **Clerk** | Hosted auth, JWT, webhooks | Cost; less custom than roll-your-own | NextAuth — more DIY |
| **Stream Video** | WebRTC + UI components fast | Per-minute pricing; dependency | Raw WebRTC — weeks of signaling/TURN |
| **Monaco** | IDE-like editing | Heavy bundle | CodeMirror — lighter, fewer features |
| **Yjs + Hocuspocus** | Keystroke-level sync, CRDT correctness | Extra **ws-server** to deploy | Liveblocks / Convex-only transport — less control |
| **Tailwind + shadcn** | Fast consistent UI | Class-heavy JSX | CSS modules — fine, slower iteration |

**ION-style sound bite:** “I optimized for **time-to-reliable-demo** on integrations that are hard to build (auth, video, CRDT sync), and put **authorization in the backend** where it can’t be bypassed.”

---

# Part 6 — Data model & “queries” (Convex)

## Tables (`convex/schema.ts`)

**users**

- `clerkId` (indexed), `role`: `candidate` | `interviewer`, name, email, image

**interviews**

- `streamCallId` (indexed), `candidateId`, `interviewerIds[]`, `startTime`, `status`, title, …

**comments**

- `interviewId` (indexed), `content`, `rating`, `interviewerId`

## “Database queries” in interview language

Convex uses **JavaScript queries**, not SQL. You can still explain in SQL terms:

| Your access pattern | Convex | SQL analogy |
|---------------------|--------|-------------|
| User by Clerk id | `.withIndex("by_clerk_id", q => q.eq("clerkId", id))` | `SELECT * FROM users WHERE clerk_id = ?` |
| Candidate’s interviews | `.withIndex("by_candidate_id", ...)` | `WHERE candidate_id = ?` |
| Meeting by Stream id | `.withIndex("by_stream_call_id", ...)` | `WHERE stream_call_id = ?` |

**Indexes:** avoid full table scans when listing interviews for home page or verifying join.

## Convex function types (know these)

| Type | Who can call | Example |
|------|----------------|---------|
| `query` | Browser (authenticated) | `canJoinMeeting` |
| `mutation` | Browser | `createInterview` |
| `internalMutation` | Only Convex (webhook) | `syncUser` |
| `internalQuery` | Only Convex | `getInterviewByStreamCallIdInternal` |
| `httpAction` | Any HTTP client with correct auth | webhooks, ws verify |

---

# Part 7 — Security & access control story

Tell this as **layers** (ION cares about authorization):

| Layer | What | Limitation |
|-------|------|------------|
| 1 | Root layout: must be signed in | — |
| 2 | Middleware: `/dashboard`, `/schedule` | **No Convex role** on Edge |
| 3 | Admin layout + schedule page: interviewer UI | UI only — server must enforce |
| 4 | Convex `requireInterviewer`, `requireInterviewParticipant` | **Source of truth** |
| 5 | `canJoinMeeting` before video | Blocks random URLs |
| 6 | WS: JWT + Convex participant HTTP | Blocks editor sync for outsiders |
| 7 | Webhook: Svix verify | Blocks fake users |
| 8 | `WS_SERVER_SECRET` on verify endpoint | Shared secret between Convex + ws-server |

**Secrets never in browser:** `STREAM_SECRET_KEY`, `CLERK_SECRET_KEY`, `WS_SERVER_SECRET`, `CLERK_WEBHOOK_SECRET`.

**Honest gaps (shows maturity):**

- Instant “New Call” creates Stream room **without** Convex row → `canJoinMeeting` fails (**broken feature**).
- `getComments` / `addComment` / `getUserByClerkId` — weaker auth than ideal.
- Single Hocuspocus instance — scale with Redis extension later.

---

# Part 8 — Interview Q&A (ION-relevant)

Practice **short answer first**, then **2-minute deep dive** with file names.

### Project & motivation

**Q1. Walk me through your project architecture.**

**A:** Browser Next.js app. **Clerk** for login. **Convex** stores users, interviews, comments; real-time via `useQuery`. **Stream** for video; tokens from **Server Action** `streamTokenProvider`. Code sync: **Yjs** in browser, **Hocuspocus** in `ws-server/`, room id = `streamCallId`. Clerk webhook creates users; ws-server calls Convex HTTP to confirm participant.

**Q2. Why did you choose Convex instead of a REST API with Express and PostgreSQL?**

**A:** I needed **live dashboard and home page** updates without building WebSocket fan-out and REST CRUD. Convex gives typed **queries/mutations** and subscriptions. Trade-off: less SQL control and vendor coupling. At ION scale I’d evaluate Postgres where reporting and compliance need it.

**Q3. How does real-time collaborative editing work?**

**A:** **CRDT** (Yjs): concurrent keystrokes merge without a central lock. `Y.Text` holds code; `y-monaco` binds to Monaco. Transport: **WebSocket** (y-websocket protocol). **Not** the same channel as Convex or Stream — separate latency-optimized path. Auth on connect: Clerk JWT + Convex participant check.

**Q4. How do you secure the meeting?**

**A:** `canJoinMeeting` checks authenticated user is `candidateId` or in `interviewerIds`. Meeting page redirects if denied. WS server repeats check so sharing the ws URL isn’t enough without valid JWT + membership.

**Q5. Explain JWT’s role.**

**A:** Clerk issues JWT; `sub` is Clerk user id. Convex validates via `auth.config.ts`. ws-server uses `@clerk/backend` `verifyToken`. Short-lived; reduces session hijack risk vs rolling your own cookies.

**Q6. What happens when an interviewer schedules an interview?**

**A:** Stream call created first (`getOrCreate`) → `streamCallId` → `createInterview` mutation with candidate and interviewer Clerk ids. Status `upcoming`. Risk: if Convex insert fails, orphan Stream call — I’d add compensating delete or saga.

**Q7. Difference between query and mutation in Convex?**

**A:** Queries read and must be deterministic; they subscribe. Mutations write once transactionally. Example: `getMyInterviews` vs `updateInterviewStatus`.

**Q8. How would you scale to many concurrent interviews?**

**A:** Stream and Convex scale as managed services. **Bottleneck:** single Hocuspocus node — add **horizontal replicas + Redis** pub/sub. Paginate dashboard queries. Rate-limit webhooks and verify endpoint.

**Q9. What would you add next?**

**A:** Code execution sandbox (Judge0/Docker), fix instant meetings, tighten comment auth, E2E tests (Playwright), server-side join time window in `canJoinMeeting`.

**Q10. Hardest bug or challenge?**

**A (example):** Monaco mounting before Yjs synced — fixed with `pendingEditorRef` and binding after `provider.on('sync')`. Or wiring **four services** with consistent `streamCallId` as correlation id.

### OOP / design (common at ION)

**Q11. Design a class model for your interview domain.**

**A:** `User` (role), `Interview` (status, times, participants), `Comment` (rating). Services: `SchedulingService`, `MeetingAccessPolicy.canJoin(user, interview)`. Stream/Yjs are **adapters**, not domain entities. Encapsulate status transitions in one place (you partly do in `updateInterviewStatus`).

**Q12. Encapsulation / inheritance in your stack?**

**A:** You use **composition** more than inheritance: hooks (`useCollaborativeEditor`), providers (Clerk, Convex, Stream). Backend auth helpers in `convex/lib/auth.ts` — shared behavior without class hierarchies.

### Networks & protocols

**Q13. HTTP vs WebSocket — when each in your app?**

**A:** HTTP: webhooks, participant verify, Clerk/Stream HTTPS APIs. WebSocket: Convex client subscription; Yjs sync. WebSocket stays open for low-latency bidirectional editor updates.

**Q14. What is WebRTC? Did you implement it?**

**A:** Browser peer media. **Stream SDK** handles signaling, codecs, TURN. I integrated tokens and UI — I did **not** build WebRTC from scratch.

### DBMS

**Q15. Why indexes on `clerkId`, `candidateId`, `streamCallId`?**

**A:** Match query patterns: role lookup, candidate home list, join-by-URL. Without indexes, scans get slow as tables grow.

**Q16. Normalization?**

**A:** `interviewerIds` is denormalized array of Clerk ids for fast participant checks; comments reference `interviewId`. For analytics at scale, might normalize interviewers junction table.

### Behavioral (LDP)

**Q17. Why ION / Why LDP?**

**A:** Combine **software engineering** with **financial markets** impact; LDP for breadth and leadership; align with building **enterprise-grade** products.

**Q18. Tell me about a time you worked in a team.**

**A:** Use real example (university project, hackathon, internship). Tie to **group exercise**: listen, summarize, contribute concrete ideas.

**Q19. Something you don’t know.**

**A:** “I haven’t implemented X in production; here’s how I’d learn it” — interviewers at ION value this.

### FinTech angle (light touch)

**Q20. How is this relevant to trading/fintech?**

**A:** Not market data — but same engineering themes: **low-latency updates**, **strict access control**, **auditability** (status + comments), **multi-service reliability**, and **clear failure modes** (fail closed on WS auth).

---

# Part 9 — Cheat sheet & red flags

## Commands to run locally

```bash
npm run dev          # Next.js :3000
npm run dev:ws       # Hocuspocus :1234
npx convex dev       # Convex backend
```

## Key files

| Topic | File |
|--------|------|
| Schema | `convex/schema.ts` |
| Join gate | `convex/interviews.ts` → `canJoinMeeting` |
| Auth helpers | `convex/lib/auth.ts` |
| HTTP / webhooks | `convex/http.ts` |
| WS server | `ws-server/index.js` |
| Collaborative hook | `src/hooks/useCollaborativeEditor.ts` |
| Middleware | `src/middleware.ts` |
| Stream token | `src/actions/stream.actions.ts` |
| Meeting UI | `src/components/MeetingRoom.tsx` |

## Demo script (2 browsers)

1. Interviewer: schedule interview for candidate account.
2. Candidate: home shows interview → join when “live”.
3. Both: type in editor — show sync.
4. End call → dashboard pass/fail.

## Red flags — do **not** say

| Wrong | Right |
|-------|--------|
| “Code doesn’t sync” | Yjs + Hocuspocus syncs in real time |
| “Anyone with link can join” | `canJoinMeeting` + WS verify |
| “I built WebRTC from scratch” | Stream SDK |
| “Instant New Call works” | Known gap — no Convex record |

## Green flags — emphasize

- **Correlation id:** `streamCallId` links video, DB, and editor room.
- **Defense in depth** for join paths.
- **`internalMutation` for webhook-only user creation.
- **Server Action** for Stream secret.
- **Honest limitations** + concrete fixes.

---

# Part 10 — Beyond your project — ION-style CS topics

Brief refreshers — they may ask **outside** your repo.

| Topic | What to know |
|--------|----------------|
| **DSA** | Medium arrays/strings, trees (BFS/level order), hash map + linked list (**LRU cache** story), basic graphs |
| **OOP** | Encapsulation, composition over inheritance, design a **booking/taxi** class diagram |
| **OS** | Process vs thread; scheduling at high level |
| **Networks** | TCP vs UDP; HTTP request/response; DNS; TLS |
| **DBMS** | ACID; indexes; joins; normalization vs denormalize for read perf |

**LRU cache (famous ION-style question):** HashMap for O(1) lookup + doubly linked list for O(1) eviction — not in your project, but practice explaining it.

---

## Whiteboard practice homework

1. Draw **Diagram A** from memory in under 3 minutes while talking.
2. Trace **schedule → join → edit → complete** without looking at code.
3. Answer Q1, Q3, Q4, Q7 out loud in under 90 seconds each.
4. Prepare **Why ION** and **one team story** (2 minutes each).

---

*Good luck. Lead with clarity, cite real files when pressed, and be explicit about trade-offs — that matches both strong engineering and what ION LDP interviewers look for.*
