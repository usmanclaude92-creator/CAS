# CAS AI — Target Architecture (validated against actual code)

## The user's proposed shape, annotated

```
CAS Web / Android / iOS          <- all three are one web bundle; android/ and ios/ are thin
      │                             WKWebView/WebView shells with no native business logic
      ▼                             (see CAS-AI-MOBILE-READINESS.md)
CAS API                          <- src/server/app.ts, deployed via api/index.ts on Vercel.
      │                             TODAY this has 5 endpoints (admin mutations + health);
      │                             it is NOT currently the path business data reads take.
      ▼
CAS AI Gateway   [NEW — does not exist yet]
      ├── Authentication          <- reuse getCallerContext() pattern (app.ts:65-80): verify
      │                             the Supabase JWT server-side, load profile + role.
      ├── RBAC / Scope            <- reuse has_permission()/can_access_project() — either by
      │                             calling them as SQL through an RLS-scoped client, or by
      │                             porting callerHasPermission()'s logic for pre-flight checks.
      ├── AI Policy               <- system prompt + per-tool guardrails (CAS-AI-SECURITY-THREAT-MODEL.md)
      ├── Tool Registry           <- CAS-AI-TOOL-REGISTRY.md; read-only in Phase 1
      ├── Audit                   <- NEW table, server-written only (see CAS-AI-DATA-FLOW.md) —
      │                             audit_logs' existing insert policy (is_active_user() only)
      │                             is too permissive to double as the AI's own audit trail
      └── Provider Adapter        <- Anthropic Messages API, tool-use
              │
              ▼
       LLM Provider               <- Claude (Anthropic API). Provider key lives only in the
              │                      Vercel serverless function's environment, never in any
              │                      client bundle (web/android/ios all ship static assets only).
              ▼
       Authorized CAS Tools       <- each tool = one narrow, typed function; no free-form SQL
              │                      or table access is ever exposed to the model.
              ▼
       CAS API / Services         <- accountingService.ts's pure-calculation logic (extracted
              │                      to be callable server-side) OR direct RLS-scoped Postgres
              │                      queries through @supabase/supabase-js with the caller's JWT.
              ▼
      PostgreSQL / Supabase       <- RLS already enforces has_permission()/can_access_project()
                                     at this layer regardless of what the AI Gateway does —
                                     the second, database-level guardrail.
```

**Verdict: the user's proposed shape is architecturally correct and matches how the rest of CAS is already built** (an Express layer in front of Supabase, permission checks re-verified server-side, RLS as a backstop). The one revision: "CAS API" as drawn implies the AI Gateway sits behind the *existing* API. In practice the existing API has no relevant business-data routes to sit behind — the AI Gateway is a **new peer** to the admin routes inside the same Express app (`src/server/app.ts`), not a layer behind a pre-existing data API. Functionally equivalent to the diagram; worth stating precisely so Phase 1 doesn't go looking for a reporting API to wrap that isn't there.

## Two authorization layers, and why both matter

1. **Application-level (AI Gateway):** every tool call re-checks `has_permission('purchases.view')`-equivalent codes before running, and fails closed with a clear, non-data-leaking error if the caller lacks it. This gives fast, readable failures and lets tool descriptions stay honest ("requires Vendors & Payables view access") in the system prompt.
2. **Database-level (RLS):** the tool's actual query executes through a Postgres client authenticated as the *caller*, not `service_role`, so `has_permission()`/`can_access_project()` apply exactly as they do for the human UI. This is the layer that survives a bug in layer 1 — an AI Gateway coding mistake that skips a permission check still can't return rows RLS wouldn't have allowed the same user to see through the app itself.

This mirrors the existing system's actual security posture: `client_invoices_select`/`purchases_select` are gated by *both* `has_permission()` *and* `can_access_project()` at the RLS layer regardless of what any calling code does. The AI Gateway should hold itself to the same standard rather than inventing a weaker, `service_role`-based shortcut (as the existing `/api/admin/*` routes use — appropriate there, for privileged mutations reached by very few users; not appropriate for an AI surface answering arbitrary read queries from many roles).

## Model / provider choice

Anthropic Claude, called via the official `@anthropic-ai/sdk` (TypeScript — matches the rest of this codebase) from the server only. Tool-use (function calling), not free-form code execution or raw SQL tools. See `CAS-AI-TOOL-REGISTRY.md` for the tool catalog and `CAS-AI-IMPLEMENTATION-ROADMAP.md` for model/cost recommendations — left open for Phase 1 since Phase 0 does not add the dependency.
