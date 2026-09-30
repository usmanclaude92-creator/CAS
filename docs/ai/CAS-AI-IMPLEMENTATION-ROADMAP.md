# CAS AI — Implementation Roadmap & Phase-1 Entry Criteria

> **Status: all 5 phases below are now implemented.** This document is kept as-written (a Phase-0 planning snapshot) for historical context — see `docs/ai/CAS-AI-PHASE-1.md` through `CAS-AI-PHASE-5.md` for what was actually built, which followed this phase order closely but is authoritative over any detail here where the two differ.

## Testing & deployment baseline (as found)

- **Tests:** 7 files total. Six are CSV-import validators (`src/utils/{transfer,moneyIn,moneyOut,directExpense,clientInvoice,purchase}ImportValidation.test.ts`) plus one formatter suite (`src/utils/formatters.test.ts`, duplicated in `android/src/utils/`). **Zero tests** for `authService.ts`, `accountingService.ts`, `src/server/app.ts`, or any RLS policy/RPC. No integration or E2E tests found anywhere in the repo.
- **CI:** root `Lint, Test & Build` job runs `npm run lint` (ESLint + `tsc --noEmit`) + `npm test` (Vitest) + `vite build`, on every push/PR to `main`. `android/` has its own two-job pipeline (web bundle build, then Gradle APK build) on the same triggers. `ios/` has a Simulator-only unsigned build job in the same workflow, plus a separate manual-dispatch `iOS TestFlight Release` workflow (not yet run — no Apple Developer account configured). No security-scanning, dependency-audit, or database-migration-testing job exists.
- **Deployment:** Vercel, project `cas` (team `usman-claude92`), production domain `cas.artifysols.com`; builds the **root** app only (`server.ts`/`api/`), not `android/`/`ios/` (those ship as APK/IPA artifacts from CI, separately). One live Supabase project shared by all three surfaces.
- **Monitoring/backups:** not inspected as part of this codebase audit — these are Supabase/Vercel platform-level settings, outside the repository. Flagged as **UNKNOWN**, not assumed absent.

## Phase-1 Entry Criteria

| Area | Status | Why |
|---|---|---|
| Backend | **PARTIALLY READY** | `src/server/app.ts`'s auth pattern (`getCallerContext`/`callerHasPermission`) is proven and directly reusable; but zero business-data read endpoints exist to build on — the AI Gateway's read tools are new code, not a wrapper over existing routes. |
| Database | **READY** | RLS enabled on all 25 tables, real `has_permission()`/`can_access_project()` enforcement, writes go through validated RPCs. Strong foundation. |
| Authentication | **READY** | Supabase Auth, JWT verification already implemented and reused across web/android/ios identically. |
| RBAC | **READY** | Granular, table-driven permission codes (`vendors.view`, `purchases.view`, etc.), enforced at both RLS and (for admin routes) app layer. |
| Tenant isolation | **N/A** | No tenant model exists in this system; not a gap, a non-requirement. Don't build for it. |
| Project isolation | **READY** | `can_access_project()` RLS function, already governs the transactional tables an AI tool would query. |
| API | **BLOCKED** | No read/reporting endpoints exist; must be built before any tool can run (see `CAS-AI-API-READINESS.md`). This is the main Phase-1 work item, not a blocker in the sense of "broken" — just "not yet built." |
| Financial integrity | **PARTIALLY READY** | Postgres-side precision is correct (`numeric(18,3)`); TS-side uses native `number` (44 `parseFloat`/`Number()` call sites, no arbitrary-precision library) — pre-existing, low-practical-risk, but the AI must consume computed values, never re-derive them (see `CAS-AI-DATABASE-MAP.md`). |
| Web | **READY** | Single React/Vite app; AI chat UI is additive. |
| Android | **READY** | WebView wrapper of the same bundle; ships automatically once the web UI has the feature. Already calls the target backend for other authenticated actions. |
| iOS | **PARTIALLY READY** | Same WebView-wrapper readiness as Android for the AI feature itself; blocked separately (and unrelated to AI) on Apple Developer account / code signing for distribution — does not block *building* the feature, only distributing the iOS app at all. |
| Voice | **BLOCKED (not started)** | No mic permissions, no STT/TTS integration anywhere. Explicitly out of scope for this phase per the directive. |
| Documents | **PARTIALLY READY** | Storage/attachment upload-download is implemented (`construction_attachments` bucket, wired through 7 modals); no RAG/text-extraction pipeline exists — fine, since RAG is explicitly out of scope for this phase too. |
| Audit logging | **PARTIALLY READY** | `audit_logs` exists and is used for business transactions, but its permissive client-side insert policy makes it unsuitable to double as the AI's own trail as-is; a new server-write-only `ai_tool_calls` table is the recommended addition (design only, in `CAS-AI-DATA-FLOW.md` — not created in this phase). |
| Testing | **BLOCKED for confidence, not for starting** | No tests exist for any of the code an AI Gateway would sit next to (`authService`, `accountingService`, `app.ts`). Recommend adding tests alongside the first AI Gateway PR, not as a prerequisite that stalls starting — but ship nothing to production users without them. |
| Deployment | **READY** | Vercel pipeline is live, proven, and already deploys `src/server/app.ts` changes; a new route ships the same way. |
| AI integration | **NOT STARTED (by design — Phase 0 forbids it)** | See phased plan below. |

## Phased plan (Phase 1 onward — none of this is built yet)

1. **Phase 1 — Read-only MVP, one role.** Add `/api/ai/query` to `src/server/app.ts` (Anthropic TypeScript SDK, tool-use, `claude-opus-5` unless a cheaper model is explicitly chosen for cost reasons — see the Anthropic API skill's model-selection guidance for current pricing/tradeoffs). Implement 4-6 tools from `CAS-AI-TOOL-REGISTRY.md` covering the vendor/customer-balance use case from the original request. Gate the whole feature behind a new `ai_assistant.use` permission, granted initially to one role (e.g. `finance_manager`) for real-world validation before wider rollout. Add the `ai_tool_calls` audit table. Add unit tests for the new Gateway route and its permission-filtering logic (closing part of the testing gap this audit found, scoped to the new code, not a full retrofit of the existing codebase).
2. **Phase 2 — Full read-only tool catalog + broader role rollout.** Remaining tools from the registry; resolve the two flagged pre-existing issues (`ALLOWED_ORIGIN` CORS, confirm every tool's exact permission code against `permissionsData.ts` rather than assuming) as part of this PR's own review, since they touch the same file.
3. **Phase 3 — Documents (RAG).** Only after Phase 1/2 are stable in production. Extract text from `attachments` (contracts, invoices, receipts), apply the same untrusted-data handling as tool results (`CAS-AI-SECURITY-THREAT-MODEL.md` §document injection) before indexing.
4. **Phase 4 — Voice.** Only after the text Gateway is proven. Mic permissions, STT/TTS provider choice, streaming — see `CAS-AI-VOICE-READINESS.md`.
5. **Phase 5 — Write actions.** Only after read-only usage has built confidence. Every write tool calls the existing `security definer` RPCs (never raw inserts), requires explicit user confirmation of the exact parameters before executing, and is logged with `confirmed_by`/`confirmed_at`.

Each phase gate is a **decision point for the user**, not an automatic progression — this roadmap describes the dependency order, not a commitment to build all five phases.
