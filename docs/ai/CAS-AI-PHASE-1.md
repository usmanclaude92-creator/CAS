# CAS AI — Phase 1: Secure AI Gateway + Read-Only Tool Foundation

Implemented. No LLM, voice, RAG, document intelligence, or AI write actions — all explicitly deferred (see Phase 2 prerequisites at the bottom). This document describes what actually exists in `src/server/ai/` today, not a plan.

## Routes

Mounted in `src/server/app.ts` as a peer to the existing admin routes: `app.use('/api/ai', aiLimiter, aiRouter)` (`aiLimiter`: 120 requests / 15 min per the existing `express-rate-limit` pattern already used for `/api/admin`).

- **`GET /api/ai/tools`** — returns only the tools the authenticated caller currently has permission to use (`{ success: true, tools: [{ name, description, requiredPermission }] }`). A tool the caller can't use is absent, not listed-then-refused.
- **`POST /api/ai/chat`** — despite the name, does **not** call an LLM. Body: `{ "tool": "<registered tool name>", "arguments": {...} }`, i.e. exactly what a future model's tool-use turn would emit. This lets the tool layer be built and tested completely independently of any provider integration, per the Phase 1 directive's explicit scope boundary. No field on the body is ever interpreted as SQL, a table name, or a column name.

Both routes require `Authorization: Bearer <Supabase session JWT>` — 401 if missing/invalid, matching the existing `/api/admin/*` pattern exactly (`getCallerContext`).

## Auth flow

1. `getCallerContext(req)` — verifies the JWT via `supabaseAdmin.auth.getUser()`, loads `profiles` + `roles`, rejects if profile is missing or not `status: 'active'`. Identical function to the one `/api/admin/*` already used; not reimplemented.
2. Per tool call: `callerHasPermission(caller, tool.requiredPermission)` — a static, fixed permission code per tool, checked **before** argument validation and **before** any DB access. `super_admin` bypasses; everyone else needs the exact permission code in their role's `permissions` array.
3. Argument validation (`tool.validateArgs`) runs only after the permission check passes, so a caller without permission never causes any parsing/DB work to happen with their input.

## Authz / DB security model

Two independent layers, matching `CAS-AI-ARCHITECTURE.md`:

1. **App-level:** the static `requiredPermission` check above.
2. **Database-level (the layer that survives a bug in layer 1):** every tool query runs through `createCallerScopedClient(caller.jwt)` (`src/server/ai/db.ts`) — a Supabase client authenticated with the **caller's own JWT**, forwarded verbatim as the PostgREST `Authorization` header. Postgres RLS (`has_permission()`, `can_access_project()`, `is_active_user()`) therefore applies exactly as it does for that same user through the ordinary CAS UI. `service_role` (`supabaseAdmin`) is never used inside a tool handler — the only place it's used in the AI subsystem is the audit writer (`src/server/ai/audit.ts`), which intentionally must write regardless of the caller's own row-level permissions.

A tool whose correct required permission would depend on a caller-suppliable argument is treated as an authorization-bypass design bug, not a convenience — this forced two concrete design decisions:
- `get_receipts` (`money_in.view`) and `get_vendor_payments` (`money_out.view`) are separate tools, not one `get_payments` with a `direction` argument (which would let a caller holding only `money_in.view` request `money_out` data by passing `direction: "out"`).
- `get_bank_transactions` requires `bank_accounts.view` only, and is scoped to bank accounts specifically (not a caller-suppliable account-type parameter spanning cash/petty-cash).

## Tool registry

`src/server/ai/registry.ts` — `TOOL_REGISTRY: Record<string, ToolDefinition>`, keyed by tool name. `getTool(name)` looks up one tool or returns `undefined` (never throws, never falls back to arbitrary access — an unknown/malicious name like `"get_vendors; DROP TABLE vendors"` simply isn't found). `listToolsForCaller(caller)` filters the full registry down to what `GET /api/ai/tools` returns.

Every `ToolDefinition` has: `name` (`get_*`, enforced read-only by construction — no `create_*`/`update_*`/`delete_*`/`post_*`/`approve_*`/`reverse_*`/`submit_*` prefix exists in the registry, checked by `registry.test.ts`), `description`, `requiredPermission` (a real CAS permission code, `module.action` shape), `validateArgs(raw): ArgValidationResult<TArgs>`, and `handler(ctx, args): Promise<ToolResult<TResult>>`.

## Implemented tools (18)

| Tool | Table(s) | Required permission |
|---|---|---|
| `get_projects` | `projects` | `projects.view` |
| `get_project_summary` | `projects` + `client_invoices`/`purchases`/`direct_expenses` (posted-only sums) | `projects.view` |
| `get_clients` | `customers` | `customers.view` |
| `get_client_details` | `customers` (id or name lookup) | `customers.view` |
| `get_client_balance` | `client_invoices` (posted `outstanding_amount` sum) | `invoices.view` |
| `get_vendors` | `vendors` | `vendors.view` |
| `get_vendor_details` | `vendors` (id or name lookup) | `vendors.view` |
| `get_vendor_balance` | `purchases` (posted `outstanding_amount` sum) — the tool behind the original feature request's example query | `purchases.view` |
| `get_invoices` | `client_invoices` (filterable, paginated) | `invoices.view` |
| `get_invoice_details` | `client_invoices` (single row) | `invoices.view` |
| `get_receivables` | `client_invoices` (aggregate) | `invoices.view` |
| `get_payables` | `purchases` (aggregate) | `purchases.view` |
| `get_receipts` | `money_in` | `money_in.view` |
| `get_vendor_payments` | `money_out` | `money_out.view` |
| `get_expenses` | `direct_expenses` | `expenses.view` |
| `get_bank_accounts` | `bank_accounts` | `bank_accounts.view` |
| `get_bank_transactions` | `money_in` + `money_out` + `transfers`, unioned for one account | `bank_accounts.view` |
| `get_cash_position` | `bank_accounts` + `cash_accounts` + `petty_cash_accounts`, per-leg permission-gated | `treasury.view` (+ per-leg checks) |

Deltas from the Phase 0 tool-registry design and why: see the note at the top of `CAS-AI-TOOL-REGISTRY.md`.

## Request/response contract

Uniform `ToolResult<T>` (`src/server/ai/types.ts`):
```ts
type ToolResult<T> =
  | { success: true; data: T; metadata?: Record<string, unknown> }
  | { success: false; error: string };
```
`POST /api/ai/chat` returns HTTP **200** for every request that reaches tool execution — a tool-level "no matching record" or "failed to load" is a normal answer to a well-formed, authorized request, not a transport error. **401** (no/invalid session), **400** (missing/unknown tool name, invalid arguments), and **403** (missing permission) are reserved for the gates *before* execution. This is a deliberate design choice so a future LLM caller only needs to branch on the JSON body's `success` field, not HTTP status — stated explicitly in `router.ts`'s own comments.

**Bounded pagination:** every list-returning tool clamps `limit`/`offset` via `parsePagination()` — default 20, max 100, floored/clamped for negative, fractional, or non-numeric input — before it ever reaches `.range()`. No AI tool call can request an unbounded result set.

**Decimal-safe money:** every JS-side monetary sum (`get_vendor_balance`, `get_client_balance`, `get_project_summary`, `get_receivables`, `get_payables`, `get_cash_position`) uses `addMoney()` (`src/utils/formatters.ts`, integer-cent scaling), never plain float addition — verified with a fractional-cent test case (`100.005 + 200.005` must land exactly on `300.01`, not a float-drifted neighbor) in `tools.test.ts`.

**Argument validation:** hand-written, dependency-free (`src/server/ai/validation.ts`) — `requireUuid`/`optionalUuid`, `optionalString` (length-bounded, so an unbounded string can't reach an `ilike()` pattern), `optionalDate` (strict `YYYY-MM-DD`), `optionalEnum`/`requireEnum` (rejects any value outside a fixed allowed set before it reaches an `.eq()` filter). No validation library was added — none existed in this project before Phase 1, and the fixed, small tool-argument shapes don't need one.

## Audit behavior

`recordAiToolCall()` (`src/server/ai/audit.ts`) writes one row to a new `ai_tool_calls` table (migration `supabase/migrations/20260929000000_add_ai_tool_calls.sql`) **before** the response is returned to the caller, using `supabaseAdmin` (`service_role`) — the only sanctioned use of that client anywhere in the AI subsystem. `ai_tool_calls` has **no client-facing insert policy at all** (only `select`, gated by `has_permission('audit.view')`) — deliberately separate from the existing `audit_logs` table, whose insert policy (`is_active_user()` only) is client-writable and therefore not trustworthy as the AI's own tamper-resistant record of what it did. The write is best-effort: a failed audit write is logged loudly (`log('warn', ...)`) but never blocks or fails the tool response itself, matching the existing `/api/demo-requests/notify-admin` resilience pattern already in `app.ts`.

## A cycle found and fixed while writing tests

Writing a unit test that imported an `ai/tools/*.ts` file directly (bypassing `router.ts`) surfaced a real circular-import bug: `src/server/ai/registry.ts` and `src/server/ai/tools/treasury.ts` both imported `callerHasPermission`/`CallerContext` from `src/server/app.ts`, which itself imports `aiRouter` from `./ai/router`, which imports `registry.ts`. This 4-node cycle (`treasury.ts` → `app.ts` → `router.ts` → `registry.ts` → `treasury.ts`) happened to resolve safely in production only because `app.ts` is always the first module entered there (and because `callerHasPermission` is a hoisted `function` declaration) — but it broke the moment any `ai/tools/*.ts` file was imported first, e.g. by a unit test, because `registry.ts`'s eager `Object.fromEntries([...tools].map(t => [t.name, t]))` would then dereference `.name` on a not-yet-initialized circular import and throw.

**Fix:** extracted `SUPABASE_URL`, `supabaseAdmin`, `log`, `CallerContext`, `getCallerContext`, and `callerHasPermission` out of `app.ts` into a new `src/server/authContext.ts`, which imports nothing from `./ai/**` or from `app.ts`. Every `ai/**` module (and `app.ts` itself) now imports these from `authContext.ts`. This removes the cycle structurally — no module in `src/server/ai/**` imports `app.ts` anymore — rather than relying on module-evaluation-order luck. `app.ts` re-exports the same names from `authContext.ts` for API stability (nothing outside `app.ts`/`ai/**` imported them, per a full-repo grep, but the re-export costs nothing and avoids any risk of a missed caller).

## Test coverage

53 new tests across 5 files (`npx vitest run src/server/ai/` — all passing; 149 passing project-wide, no regressions to the pre-existing 96):

- **`validation.test.ts`** (17 tests) — every exported validator: UUID/date/enum/string-length accept and reject cases, including the specific inputs each guard exists to stop (a non-UUID string where an id is expected, a value outside an allowed enum reaching a filter, an over-length search string).
- **`pagination.test.ts`** (6 tests) — default/clamp/floor/negative/non-numeric behavior of `parsePagination`, including the exact "clamp above `MAX_PAGE_SIZE`" case that is the guard against an unbounded AI query.
- **`registry.test.ts`** (10 tests) — every tool's shape (name/description/permission-code format), read-only-by-construction (no write-verb-prefixed name exists), unknown/malicious tool-name lookup safety, and `listToolsForCaller` permission-filtering correctness (including a null-role caller and a no-hidden-cross-caller-cache check).
- **`tools/tools.test.ts`** (12 tests) — handler-level tests against hand-built fake Supabase query-builder objects: decimal-safe money summation (the fractional-cent case above), ambiguous-name-match handling, "not found" vs. false-zero-balance distinction, pagination reaching `.range()` with the exact clamped values, `get_project_summary`'s posted-only filtering (draft/rejected rows excluded from sums), `get_receipts`/`get_vendor_payments` hitting distinct tables under distinct permissions, `get_bank_transactions`'s row cap, and `get_cash_position`'s per-leg permission-skip behavior (including the all-legs-skipped/null-total case). One test simulates a cross-project-access attempt at the handler level: a fake `db` returning no row for `get_project_summary` (what RLS filtering a caller's own project set down to nothing looks like from the tool's perspective) asserts a clean "not found or not accessible" error, never a crash or a false zero.
- **`router.test.ts`** (8 tests) — the real `aiRouter` driven end-to-end via `http.createServer()` + built-in `fetch()` (no new test-framework dependency), with `../authContext` mocked (`vi.mock` + `vi.hoisted`) for deterministic auth/authz: 401 on both routes with no session, `GET /api/ai/tools` lists only permitted tools, 400 for an unknown tool name and for a missing `"tool"` field, 403 when the caller lacks the required permission, 400 for invalid arguments (proving validation runs before any DB call), and a fully authorized dispatch whose downstream DB call is made to fail deterministically (mocked `SUPABASE_URL` pointed at `127.0.0.1:9`, nothing listening) — asserting the router still returns a safe, uniform `200 { success: false, error: <string> }` body with no stack trace or internal detail leaked, regardless of whether the failure was a thrown exception (caught in `router.ts`'s `try/catch`) or a resolved Postgrest error.

## Known limitations

- **No live database/integration testing was possible in this environment.** Outbound HTTPS to `*.supabase.co` is blocked by this sandbox's egress policy (`connect_rejected`, confirmed via a direct `curl` using the real anon key). All tests above are pure-unit or use fake/mocked Supabase-shaped objects; RLS enforcement itself, the applied migration, and true end-to-end behavior against a real database have **not** been verified in this session and must be exercised in a real environment (or CI with network access) before this is trusted in production.
- **The `ai_tool_calls` migration has not been applied to any live database.** `recordAiToolCall()` degrades to a logged warning (never a failed response) if the table doesn't exist yet, so this is non-blocking but must be applied before audit records actually persist.
- **`get_project_summary`/`get_client_balance`/`get_vendor_balance`/`get_receivables`/`get_payables` only sum rows with `status = 'posted'`.** This matches how outstanding/financial totals are computed elsewhere in this app, but is an assumption worth confirming against the exact UI computation being mirrored, since it was not verified against a live comparison.
- **Summation queries are capped** (`SUMMARY_ROW_CAP`/`BALANCE_ROW_CAP` = 2000, `AGGREGATE_ROW_CAP` = 2000, `TRANSACTION_ROW_CAP` = 500) rather than computed via a Postgres-side aggregate — documented in-code; revisit if any single project/vendor/client ever exceeds these row counts.
- **`POST /api/ai/chat` does not call an LLM** — by design for Phase 1, but worth restating: nothing in this phase can answer a natural-language question yet.
- **No conversation/session state** (`ai_conversations` from the original data-flow design) exists yet — each `/api/ai/chat` call is a single, stateless tool invocation.

## Phase 2 prerequisites

1. Apply `supabase/migrations/20260929000000_add_ai_tool_calls.sql` to a real database and verify `recordAiToolCall()` actually persists rows (this session could not).
2. Verify RLS behavior end-to-end against a live database with a real caller JWT — confirm `can_access_project`/`has_permission` actually scope tool results the way `CAS-AI-ARCHITECTURE.md` and this document assert, since no live query has run in this session.
3. Add the Anthropic SDK dependency and the Provider Adapter layer (`CAS-AI-ARCHITECTURE.md`'s "Provider Adapter" box) — wire `POST /api/ai/chat` (or a new endpoint) to accept a natural-language `question`, call Claude with the `GET /api/ai/tools`-filtered tool schemas, and loop tool_use turns through the existing `getTool`/`callerHasPermission`/handler path unchanged.
4. Add `ai_conversations` (or equivalent) for multi-turn state, per `CAS-AI-DATA-FLOW.md`.
5. Expand the tool catalog per `CAS-AI-TOOL-REGISTRY.md` (e.g. `get_purchases`, `get_business_partner_balance`, `get_ledger_entries`, `get_documents`) if the Phase 2 scope calls for them.
