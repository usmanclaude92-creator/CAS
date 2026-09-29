# CAS AI — Database Map

Source: `supabase/migrations/20260922000000_auth_and_rls_rearchitecture.sql` (base schema + RLS) plus 12 incremental migrations under `supabase/migrations/`. One live Supabase project; `android/supabase/migrations/` is a **stale partial copy** (5 of the 13 root migration files — missing `add_business_partners`, `add_customer_vatin`, `seed_expense_head_subcategories`, `add_vendor_vatin`, `add_vat_transaction_fields`, `vat_phase2_sequential_numbering_credit_debit_notes`, `rename_import_historical_client_invoice_rpc`). Both apps connect to the same live project (`VITE_SUPABASE_URL` baked in at build time), so this is a repo-hygiene issue, not a live schema divergence — but it means `android/supabase/migrations/` cannot be trusted as a schema reference and should not be read by anyone (human or AI) as source of truth.

## No tenant/organization model

Grepped every migration for `organization_id` / `tenant_id` / `company_id` — zero matches. This is a **single-tenant** system (one company). There is no tenant boundary to design for. The only boundaries are:

- **Role/permission** — via `has_permission(perm text)`, checked in nearly every RLS policy.
- **Project assignment** — via `can_access_project(p_project_id uuid)`, checked on `projects`, `client_invoices`, `purchases` (and should be checked, or inherited via join, on any AI tool touching project-scoped transactional data).

## Core RLS functions

```sql
-- supabase/migrations/20260922000000_auth_and_rls_rearchitecture.sql:514-539
has_permission(perm text) returns boolean        -- profiles.role_code -> roles.permissions[] contains perm
can_access_project(p_project_id uuid) returns boolean  -- profiles.is_all_projects OR user_project_assignments row
is_active_user() returns boolean                 -- profiles.status = 'active'
```

All three are `security definer`, `stable`, `set search_path = public` — correctly hardened against search-path hijacking. **Any AI tool that queries Postgres directly with the requesting user's own JWT gets this scoping for free.** A tool that instead uses the `service_role` key (as `src/server/app.ts`'s admin client does) gets **none** of it and must re-implement the equivalent checks in application code — this is the difference that matters most for AI tool safety (see `CAS-AI-ARCHITECTURE.md`).

## Tables (25)

| Table | RLS select policy | Notes |
|---|---|---|
| `roles` | `is_active_user()` | `permissions` is a `text[]` column read by `has_permission()` |
| `profiles` | self OR `users.view` | one row per Supabase Auth user; `role_code`, `status`, `is_all_projects` |
| `user_project_assignments` | `is_active_user()` | project-level ACL rows |
| `workflow_settings` | `is_active_user()` | approval workflow config |
| `approval_limits` | `is_active_user()` | per-role/module OMR approval thresholds |
| `customers` | `is_active_user()` (broad read) | master data; write gated by `customers.create`/`.edit` |
| `vendors` | `is_active_user()` (broad read) | master data; write gated by `vendors.create`/`.edit` |
| `business_partners` | RLS enabled (migration `20260923150000`) | 4th treasury counterparty type (directors/JV/intercompany); reuses `transfers` mechanics, not a parallel ledger |
| `projects` | `projects.view` AND `can_access_project(id)` | this is the real per-project boundary |
| `bank_accounts` | `bank_accounts.view` | |
| `cash_accounts` | `cash.view` (write needs `treasury.view` AND `settings.edit`) | |
| `petty_cash_accounts` | `petty_cash.view` (write needs `treasury.view` AND `settings.edit`) | |
| `expense_heads` | `is_active_user()` | expense category master data |
| `client_invoices` | `invoices.view` AND `can_access_project(project_id)` | draft edits restricted to `created_by = auth.uid()` |
| `purchases` | `purchases.view` AND `can_access_project(project_id)` | same draft-edit-own-row pattern |
| `money_in` | RLS enabled | receipts against receivables |
| `money_out` | RLS enabled | vendor payments |
| `direct_expenses` | RLS enabled | site expenses, has VAT fields (`net_amount`, `vat_amount`, `vat_rate`) |
| `transfers` | RLS enabled | bank/cash/petty-cash/business-partner movements |
| `opening_balances` | RLS enabled | |
| `journal_entries` | RLS enabled | **real double-entry ledger** — `debit_account`, `credit_account`, `debit_amount`, `credit_amount`, `source_type`, `source_id`; has a check constraint requiring project/customer/vendor traceability unless `source_type in ('transfer','opening')`. This is the authoritative general ledger a "get transaction history / get ledger" tool should read. |
| `audit_logs` | select needs `audit.view`; **insert only needs `is_active_user()`** | see threat model — client-initiated, not server-enforced |
| `attachments` | RLS enabled | `storage_path`, `public_url`, links to private Storage bucket `construction_attachments` (confirmed `public: false`); wired through `supabaseClient.ts` and used by 7 transaction modals — document upload/download **is** implemented, contrary to an initial assumption |
| `notifications` | RLS enabled | per-user |
| `demo_requests` | RLS enabled | public sign-up funnel; approved via `src/server/app.ts` admin route |
| `master_import_audit` | RLS enabled | tracks bulk CSV imports (the "…import" permission family) |
| `document_sequences` | RLS enabled (migration `20260923210000`) | sequential numbering for VAT-compliant documents |
| `credit_debit_notes` | RLS enabled (migration `20260923210000`) | VAT phase-2 credit/debit note support |

## Write path: RPCs, not raw inserts

```
supabase/migrations/20260922000003_balance_and_reversal_rpcs.sql
  adjust_account_balance(p_account_type, p_account_id, p_delta)
  reverse_transaction(p_module, p_id, p_reason)
supabase/migrations/20260922000004_transaction_creation_rpcs.sql
  create_client_invoice(payload jsonb)
  record_money_in(payload jsonb)
  create_purchase(payload jsonb)
  record_money_out(payload jsonb)
  create_direct_expense(payload jsonb)
  create_transfer(payload jsonb)
  set_opening_balance(payload jsonb)
```

All financial mutations funnel through these `security definer` functions. **This is the pattern any future AI write-tool must reuse** — never a direct `insert into money_in (...)` from a tool. It also means an AI write tool's "guardrail" is largely already implemented at the database layer; the tool wrapper's job is authentication, permission pre-check (fail fast with a clear message rather than relying solely on the RPC's own internal checks), confirmation-gating, and audit logging of the *request*, not re-validating accounting rules.

## Financial precision

- Postgres: `numeric(18,3)` for money (`numeric(5,2)` for `vat_rate`) — exact, fixed-point, correct choice.
- TypeScript: `accountingService.ts` calls `parseFloat`/`Number()` 44 times — every value becomes an IEEE-754 double the moment it leaves Postgres. No `decimal.js`/`big.js`/equivalent is used anywhere in the codebase.
- **Practical risk today:** low — OMR amounts at 3-decimal precision stay well within a double's ~15-17 significant digits for realistic transaction volumes, and no bug reports link to this. It is a **latent** risk (large-scale summation drift, repeated re-aggregation), not an active one.
- **AI-specific requirement:** the AI must **read** already-computed values from these tables/services (e.g. `client_invoices.outstanding_amount`, `accountingService.getDashboardSummary()`) and present them, or do only display-level formatting — it must never re-derive a balance by summing raw rows itself. This is stricter than what the existing UI does, and is the correct posture: today's client-side JS math is trusted because it's fixed, reviewed application code; an LLM re-deriving the same arithmetic on the fly is not trustworthy to the same standard, independent of the float-precision question.
