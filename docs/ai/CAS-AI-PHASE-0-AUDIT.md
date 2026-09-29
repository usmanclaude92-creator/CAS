# CAS AI — Phase 0 Audit

**Status:** Audit only. No production code, schema, dependencies, or configuration were changed.
**Scope inspected:** `usmanclaude92-creator/CAS` — root web app (`src/`, `api/`, `src/server/`), `android/` (WebView wrapper app), `ios/` (WebView wrapper app), `supabase/migrations/*.sql` (live schema), CI (`.github/workflows/ci.yml`).
**Not inspected:** `usmanclaude92-creator/CAS-App` — a superseded standalone repo. Per this project's own standing direction ("we are working on `CAS/android`"), CAS-App is not part of the active ecosystem and is out of scope for this audit. If it is still deployed anywhere, it must be accounted for separately before Phase 1.

## Executive Summary

CAS is a **single-tenant** (one company, "Artify Construction Accounting System — Sultanate of Oman") construction accounting system. There is no `organization_id`/`tenant_id`/`company_id` anywhere in the schema — isolation in this system is **role/permission-based and project-based**, not tenant-based. Any AI design that assumes multi-tenant isolation is solving the wrong problem here; the real boundary to inherit is Postgres RLS keyed off `has_permission(perm)` and `can_access_project(project_id)`.

The system's authorization model is genuinely solid: 25 tables, RLS enabled on every business table, two `security definer` SQL functions (`has_permission`, `can_access_project`) enforce role-permission and project-assignment scoping at the database layer, and financial **writes** go through validated Postgres RPCs (`create_client_invoice`, `record_money_in`, `create_purchase`, `record_money_out`, `create_direct_expense`, `create_transfer`, `set_opening_balance`, `reverse_transaction`) rather than raw table inserts. This is a strong foundation for AI tool design: read tools can be RLS-scoped table queries; any future write tool should call the same RPCs, never raw inserts.

The gap is on the **application/API side, not the database side**: there is currently no server-side reporting/query API at all. All business-data reads (dashboard, reports, balances) happen by the browser/WebView querying Supabase directly with the anon key, with RLS as the only enforcement layer, and all aggregation (project profitability, cash-flow forecasts, KPI tiles) happens **client-side in TypeScript** over the raw rows. The only real backend (`src/server/app.ts`, deployed as `api/index.ts` on Vercel) exists solely for five endpoints: health check, a demo-request email relay, and three `service_role` admin-user-management actions. Building AI tools therefore means building a small number of new, purpose-built, permission-checked read endpoints (or RLS-scoped direct queries from a server context) — there is no existing "reporting API" to wrap.

## Key Findings (see linked docs for full detail)

| # | Finding | Severity | Doc |
|---|---|---|---|
| 1 | No server-side reporting/query API exists; all reads are direct browser→Supabase, all aggregation is client-side | Architecture gap (not a vulnerability) | `CAS-AI-API-READINESS.md` |
| 2 | RLS is real and per-table (`has_permission`/`can_access_project`), not a rubber stamp | Strength | `CAS-AI-DATABASE-MAP.md` |
| 3 | Writes go through `security definer` RPCs with validation; direct table writes are not the pattern | Strength | `CAS-AI-DATABASE-MAP.md` |
| 4 | Single-tenant system — no tenant isolation model exists or is needed; project + permission scoping is the real boundary | Architecture fact | `CAS-AI-DATABASE-MAP.md`, `CAS-AI-SECURITY-THREAT-MODEL.md` |
| 5 | Money amounts are `numeric(18,3)` in Postgres (exact) but coerced through `parseFloat`/`Number()` (44 call sites in `accountingService.ts`) once in TypeScript — an existing, pre-AI precision posture the AI must not make worse | Medium (pre-existing) | `CAS-AI-DATABASE-MAP.md` |
| 6 | `audit_logs` inserts are client-initiated (`is_active_user()` policy only) — sufficient for today's human-driven UI, **not** sufficient as the AI's own audit trail | Medium | `CAS-AI-SECURITY-THREAT-MODEL.md`, `CAS-AI-DATA-FLOW.md` |
| 7 | Zero test coverage outside CSV-import validators and one formatter suite; no tests for `authService`, `accountingService`, or `src/server/app.ts` | Medium | `CAS-AI-IMPLEMENTATION-ROADMAP.md` §Testing |
| 8 | Android and iOS are thin WKWebView/WebView shells around the **same** web bundle — an AI Gateway built once behind `/api/ai/*` automatically serves all three surfaces with no mobile-specific backend work | Strength | `CAS-AI-MOBILE-READINESS.md` |
| 9 | Zero voice readiness on any surface — no mic permission declared, no speech API referenced anywhere | Not started | `CAS-AI-VOICE-READINESS.md` |
| 10 | `android/supabase/migrations/` is a stale, partial copy of the root migrations (missing the 7 most recent ones) — harmless today only because both apps point at the same live Supabase project, but a documentation/drift hazard | Low | `CAS-AI-DATABASE-MAP.md` |
| 11 | Document/attachment storage **is** implemented (`construction_attachments` private bucket, wired through 7+ modal components) — earlier assumption that it was schema-only was wrong; corrected after checking `supabaseClient.ts` wrappers, not just component files | Informational | `CAS-AI-RAG` section below / `CAS-AI-TOOL-REGISTRY.md` |
| 12 | iOS has no code signing / Apple Developer account yet (tracked separately, pre-dates this audit) — irrelevant to the AI feature itself since both mobile shells consume the same backend | Informational | `CAS-AI-MOBILE-READINESS.md` |

## Phase-1 Entry Checklist

See `CAS-AI-IMPLEMENTATION-ROADMAP.md` §14 for the full READY/BLOCKED/PARTIAL table with justification per row.

## Documents in this audit

1. `CAS-AI-PHASE-0-AUDIT.md` — this file
2. `CAS-AI-ARCHITECTURE.md`
3. `CAS-AI-DATA-FLOW.md`
4. `CAS-AI-SECURITY-THREAT-MODEL.md`
5. `CAS-AI-TOOL-REGISTRY.md`
6. `CAS-AI-DATABASE-MAP.md`
7. `CAS-AI-API-READINESS.md`
8. `CAS-AI-MOBILE-READINESS.md`
9. `CAS-AI-VOICE-READINESS.md`
10. `CAS-AI-IMPLEMENTATION-ROADMAP.md`
