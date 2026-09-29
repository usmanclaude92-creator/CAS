# CAS AI — API Readiness Audit

## What exists today

One Express app, `src/server/app.ts` (310 lines), deployed two ways:

- **Vercel (production):** `api/index.ts` imports and directly exports `app` as the serverless function; `vercel.json` rewrites every `/api/(.*)` request to it.
- **Local/non-Vercel:** `server.ts` boots the same `app` with Vite middleware (dev) or static file serving (prod fallback) — confirmed by its own comment (`server.ts:18-20`) that this path is unused on Vercel.

### Endpoints (all five)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | liveness check |
| POST | `/api/demo-requests/notify-admin` | none (rate-limited, 20/15min) | relays a new demo request to an admin mailbox via formsubmit.co, so the destination address never ships in the client bundle |
| POST | `/api/admin/users` | `requireAdmin('users.create')` | creates a real Supabase Auth user + profile (`service_role`) |
| POST | `/api/admin/users/:id/set-password` | `requireAdmin('users.edit')` + `super_admin` only | resets another user's password (`service_role`) |
| POST | `/api/admin/demo-requests/:id/approve` | `requireAdmin('users.create')` | provisions/links a Supabase Auth account for an approved demo request (`service_role`) |

Middleware: `helmet()`, `cors()` (origin from `ALLOWED_ORIGIN` env, falls back to `true` = reflect-any-origin if unset — see security doc), `express.json({limit:'2mb'})`, a 30-req/15-min limiter scoped to `/api/admin`.

### The auth pattern worth reusing

`getCallerContext(req)` (`src/server/app.ts:65-80`): reads `Authorization: Bearer <jwt>`, verifies it with `supabaseAdmin.auth.getUser(token)`, loads the caller's `profiles` row (must be `status === 'active'`), loads their `roles` row. `callerHasPermission(caller, code)` (`app.ts:82-85`) then checks `role.code === 'super_admin' OR role.permissions.includes(code)`. `requireAdmin(code)` wraps both into Express middleware.

**This is exactly the shape a new `/api/ai/*` auth layer should copy** — it is proven, already deployed, and independently re-verifies the caller server-side rather than trusting a client-supplied claim.

### The gap

Every one of the five endpoints is either infrastructure (health) or a privileged **admin mutation**. **There is no read/query/reporting endpoint of any kind.** Everything the UI shows — dashboard KPIs, vendor/customer balances, project financials, cash-flow forecasts — is fetched by the browser calling Supabase directly (`@supabase/supabase-js`, anon key, RLS-scoped by the user's own session) and aggregated in `accountingService.ts` / individual view components (`ReportsView.tsx:203-205,512` calls `accountingService.getState()`, `.getDashboardSummary()`, `.getAllProjectProfitabilities()`, `.getJournalEntries()` — all client-side).

**Consequence for AI tools:** there is no existing service layer to "wrap." Two viable designs:

1. **New endpoints that proxy an RLS-scoped Supabase client** — `/api/ai/query` (or per-tool routes) mint a Supabase client authenticated with the *caller's own JWT* (not `service_role`), so Postgres RLS enforces the same read boundary the browser already gets, as a second independent layer under the endpoint's own permission check. This is the recommended design — it reuses the database's own, already-audited authorization instead of re-deriving it in a new place.
2. Reuse `accountingService.ts`'s aggregation logic server-side (it currently only runs in the browser) — desirable for numbers that require the *same* computed values the UI shows (e.g. `getDashboardSummary()`), to guarantee the AI never presents a number the UI itself wouldn't show. This likely means extracting the pure-calculation parts of `accountingService.ts` into an isomorphic module callable from both the browser and `src/server/`.

Both are additive (new files/functions), not modifications to existing endpoints — consistent with the Phase-0 "no changes" constraint, and safe to build in Phase 1.

### CORS note

`cors({ origin: process.env.ALLOWED_ORIGIN ? .split(',') : true })` — if `ALLOWED_ORIGIN` is unset in the deployed environment, this reflects *any* origin with `credentials: true`. Worth confirming `ALLOWED_ORIGIN` is actually set in Vercel before an AI endpoint (which will handle a Bearer token rather than cookies, lowering but not eliminating the stakes) goes live. Not a Phase-0 blocker; flagged for Phase 1 verification.
