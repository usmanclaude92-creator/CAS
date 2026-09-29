# CAS AI — Tool Registry (design, not implemented)

> **Phase 1 implementation status:** 18 of the tools below are now real, in `src/server/ai/tools/*.ts`, registered in `src/server/ai/registry.ts`. Three deltas from this design, each forced by the static-permission-per-tool rule stated in `CAS-AI-SECURITY-THREAT-MODEL.md` (a tool's `requiredPermission` must not depend on a caller-suppliable argument):
> - `get_money_in` / `get_money_out` above are implemented as **`get_receipts`** (`money_in.view`) and **`get_vendor_payments`** (`money_out.view`) — same two-tools-not-one shape this doc already called for, renamed for clarity.
> - `get_bank_transactions` is scoped to `bank_accounts.view` only (one `accountId`, unions `money_in`+`money_out`+`transfers` rows referencing it) rather than a `journal_entries`-based cross-account-type query — `journal_entries` turned out not to be the right source once implemented; see `CAS-AI-DATABASE-MAP.md`.
> - `get_purchases`, `get_business_partner_balance`, `get_ledger_entries`, and `get_documents` from this catalog were **not** implemented in Phase 1 (out of scope for the read-only MVP cut); `get_client_details` **was** kept as its own tool (`get_client_details`) alongside `get_clients`, contrary to this doc's original "drop it" recommendation, to keep an id-or-name lookup with ambiguous-match handling consistent with `get_vendor_details`.
>
> Full implemented list: `get_projects`, `get_project_summary`, `get_clients`, `get_client_details`, `get_client_balance`, `get_vendors`, `get_vendor_details`, `get_vendor_balance`, `get_invoices`, `get_invoice_details`, `get_receivables`, `get_payables`, `get_receipts`, `get_vendor_payments`, `get_expenses`, `get_bank_accounts`, `get_bank_transactions`, `get_cash_position`. See `CAS-AI-PHASE-1.md` for the response contract and pagination/row-cap values actually enforced.

Every tool below maps to tables/services confirmed to exist (`CAS-AI-DATABASE-MAP.md`). Tools **not** grounded in a real table/RPC from the user's suggested list are marked and either remapped or dropped. All tools are **read-only** for Phase 1. No tool accepts or constructs raw SQL; every tool has a fixed, typed parameter schema (`strict: true`).

Execution model for every row: query runs through a Postgres/Supabase client authenticated with the **caller's own JWT** (RLS applies), gated by an app-level permission pre-check using the same permission code named in the "Required permission" column, and every call is written to `ai_tool_calls` (see `CAS-AI-DATA-FLOW.md`) before the result reaches the model.

| Tool | Maps to | Required permission | Project scope | Params | Sensitive fields returned |
|---|---|---|---|---|---|
| `get_projects` | `projects` | `projects.view` | RLS `can_access_project` filters the set automatically | `status?`, `search?` | none beyond what `projects.view` already exposes in-app |
| `get_project_financials` | `projects` + `accountingService`'s project-profitability calc (`getAllProjectProfitabilities`) | `projects.view` | `can_access_project(project_id)` | `project_id` | contract value, budget, spend, margin — same fields `ReportsView.tsx` already shows this role |
| `get_customers` | `customers` | `customers.view` | broad (`is_active_user()`) | `search?` | contact info — acceptable, same as UI |
| `get_customer_balance` | `client_invoices` (`outstanding_amount`) + `money_in` | `customers.view` + `invoices.view` | joined project scope via `can_access_project` | `customer_id` or `customer_name` | outstanding receivable total, aging if computed elsewhere in-app |
| `get_vendors` | `vendors` | `vendors.view` | broad (`is_active_user()`) | `search?` | contact info — acceptable, same as UI |
| `get_vendor_balance` | `purchases` (`outstanding_amount`) + `money_out` | `purchases.view` | joined project scope via `can_access_project` | `vendor_id` or `vendor_name` | outstanding payable total — this is the tool behind the example query in the original feature request ("what's the outstanding balance of Vendor xyz") |
| `get_invoices` | `client_invoices` | `invoices.view` | `can_access_project(project_id)` | `project_id?`, `customer_id?`, `status?`, `date_range?` | amounts, status, VAT fields |
| `get_invoice_details` | `client_invoices` (single row) | `invoices.view` | `can_access_project(project_id)` | `invoice_id` | full row incl. `vat_amount`/`vat_rate` |
| `get_purchases` (renamed from suggested `get_suppliers`/`get_supplier_details` — those don't map to any table; vendor **master data** is `get_vendors`/`get_vendor_balance` above, vendor **bills** are this) | `purchases` | `purchases.view` | `can_access_project(project_id)` | `project_id?`, `vendor_id?`, `status?` | |
| `get_receivables` | aggregate over `client_invoices.outstanding_amount` | `invoices.view` | scoped set | `project_id?`, `as_of_date?` | |
| `get_payables` | aggregate over `purchases.outstanding_amount` | `purchases.view` | scoped set | `project_id?`, `as_of_date?` | |
| `get_money_in` / `get_money_out` (renamed from suggested `get_payments`, which is ambiguous between AR receipts and AP payments — CAS models them as two separate tables/permissions) | `money_in` / `money_out` | `money_in.view` / `money_out.view` | joined project scope | `project_id?`, `date_range?` | |
| `get_direct_expenses` | `direct_expenses` | `expenses.view` | joined project scope | `project_id?`, `expense_head_id?`, `date_range?` | |
| `get_bank_accounts` | `bank_accounts` | `bank_accounts.view` | n/a (not project-scoped) | none | current balance |
| `get_bank_transactions` (suggested; no dedicated ledger table exists per-account — real source is `journal_entries` filtered by `debit_account`/`credit_account`, or `transfers`) | `journal_entries` and/or `transfers` | `treasury.view` (confirmed code) | n/a | `account_id`, `date_range?` | |
| `get_cash_position` | `cash_accounts` + `petty_cash_accounts` + `bank_accounts`, likely via `accountingService.getDashboardSummary()`'s existing aggregate rather than re-summing | `cash.view`/`petty_cash.view`/`bank_accounts.view` (tool only runs sub-queries the caller has permission for; partial results with a note, not a hard failure, if the caller lacks one leg) | n/a | none | |
| `get_business_partner_balance` (not in the suggested list, but a real table — director/JV/intercompany balances) | `business_partners` | `business_partners.view` (confirmed code) | n/a | `partner_id` or `partner_name` | |
| `get_ledger_entries` (replaces suggested `get_contracts`/`get_contract_variations`, which do not exist as tables — CAS has no contract-variations concept in this schema) | `journal_entries` | `reports.view` (confirmed code) | via `project_id`/`customer_id`/`vendor_id` columns on the row | `source_type?`, `project_id?`, `date_range?` | debit/credit account names, amounts |
| `get_documents` | `attachments` | permission tied to the parent transaction's own view permission (e.g. an invoice's attachments require `invoices.view`) — **do not** expose a bare `get_documents` that lists across all transaction types irrespective of the caller's per-module access | `related_transaction_id`, `related_transaction_type` | returns `file_name`/`file_type`/`uploaded_at` and a short-lived signed URL if the caller may view it — never the raw `storage_path` |

## Explicitly dropped from the suggested list (no basis in the actual schema)

- `get_reports` — too broad to be a safe tool surface; "reports" in this app are computed views over the tables above (`ReportsView.tsx`), not a queryable entity. Model composes an answer from the specific tools above instead of a catch-all.
- `get_contracts` / `get_contract_variations` — no such tables. CAS's `projects` table has `contract_value`/`budget_cost` scalar fields, not a contracts/variations sub-model. If this is a real business need, it's a schema gap to raise with the user, not something to fake with a misleading tool name.
- `get_client_details` as a **separate** tool from `get_customers` — CAS's `customers` table already carries the same "details" fields a details view would show; one tool with an optional `customer_id` filter covers both, avoiding two near-duplicate schemas to keep in sync.

## Naming convention

`get_<entity>` for lookups/lists, `get_<entity>_balance` / `get_<entity>_details` for a single computed or detailed view. No tool verb other than `get_*` exists in Phase 1 — enforced by the registry itself (no `create_*`/`update_*`/`delete_*` entries), not just by policy.
