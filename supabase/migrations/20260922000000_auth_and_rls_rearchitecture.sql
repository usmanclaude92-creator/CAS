-- ==============================================================================
-- CAS ACCOUNTING SYSTEM — AUTH & RLS REARCHITECTURE
-- Replaces the client-only-authorization / USING(true) RLS model with
-- Supabase Auth + role/permission-aware Row Level Security enforced in Postgres.
-- ==============================================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------
-- 1. ROLES & PERMISSIONS (server-side source of truth)
-- ------------------------------------------------------------------
create table if not exists roles (
  code varchar(50) primary key,
  name varchar(100) not null,
  description text,
  is_system boolean not null default false,
  permissions text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------------
-- 2. PROFILES (1:1 with auth.users — no more plaintext password storage)
-- ------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  username varchar(100),
  full_name varchar(255) not null,
  mobile varchar(50),
  role_code varchar(50) not null references roles(code),
  status varchar(20) not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  is_demo boolean not null default false,
  force_password_reset boolean not null default false,
  two_factor_enabled boolean not null default false,
  department varchar(100),
  employee_id varchar(100),
  is_all_projects boolean not null default true,
  remarks text,
  last_login timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_project_assignments (
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid not null,
  primary key (user_id, project_id)
);

-- ------------------------------------------------------------------
-- 3. WORKFLOW SETTINGS & APPROVAL LIMITS
-- ------------------------------------------------------------------
create table if not exists workflow_settings (
  id boolean primary key default true check (id),
  separation_of_duties_enabled boolean not null default true,
  require_approval_above_omr numeric(18,3) not null default 0.000,
  updated_at timestamptz default now()
);

create table if not exists approval_limits (
  role_code varchar(50) primary key references roles(code) on delete cascade,
  max_amount_omr numeric(18,3) not null default 0.000
);

-- ------------------------------------------------------------------
-- 4. MASTER DATA
-- ------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) unique not null,
  name varchar(255) not null,
  contact_person varchar(255),
  phone varchar(50),
  email varchar(255),
  address text,
  opening_balance numeric(18,3) default 0.000,
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) unique not null,
  name varchar(255) not null,
  category varchar(100),
  contact_person varchar(255),
  phone varchar(50),
  email varchar(255),
  address text,
  opening_balance numeric(18,3) default 0.000,
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) unique not null,
  name varchar(255) not null,
  customer_id uuid references customers(id) on delete restrict,
  contract_value numeric(18,3) not null default 0.000 check (contract_value >= 0),
  budget_cost numeric(18,3),
  start_date date not null,
  end_date date,
  status varchar(20) default 'active' check (status in ('active','completed','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_project_assignments
  add constraint fk_upa_project foreign key (project_id) references projects(id) on delete cascade;

create table if not exists bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  bank_name varchar(255) not null,
  account_name varchar(255) not null,
  account_number varchar(100),
  iban varchar(100),
  branch varchar(255),
  currency varchar(10) default 'OMR',
  opening_balance numeric(18,3) default 0.000,
  current_balance numeric(18,3) default 0.000,
  opening_date date not null default current_date,
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists cash_accounts (
  id uuid primary key default uuid_generate_v4(),
  account_name varchar(255) not null,
  opening_balance numeric(18,3) default 0.000,
  current_balance numeric(18,3) default 0.000,
  opening_date date not null default current_date,
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists petty_cash_accounts (
  id uuid primary key default uuid_generate_v4(),
  account_name varchar(255) not null,
  opening_balance numeric(18,3) default 0.000,
  current_balance numeric(18,3) default 0.000,
  opening_date date not null default current_date,
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists expense_heads (
  id uuid primary key default uuid_generate_v4(),
  name varchar(255) unique not null,
  category varchar(100),
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------
-- 5. TRANSACTIONAL TABLES (full workflow state machine)
-- ------------------------------------------------------------------
create table if not exists client_invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_type varchar(20) not null check (invoice_type in ('IPC','Invoice')),
  invoice_number varchar(100) unique not null,
  date date not null,
  customer_id uuid not null references customers(id) on delete restrict,
  project_id uuid not null references projects(id) on delete restrict,
  description text,
  amount numeric(18,3) not null check (amount > 0),
  document_ref varchar(100) not null,
  attachment_url text,
  attachment_name varchar(255),
  received_amount numeric(18,3) default 0.000 check (received_amount >= 0),
  outstanding_amount numeric(18,3) not null check (outstanding_amount >= 0),
  status varchar(20) default 'draft' check (status in ('draft','submitted','approved','rejected','posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_by_name varchar(255),
  approved_at timestamptz,
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  purchase_invoice_number varchar(100) unique not null,
  date date not null,
  vendor_id uuid not null references vendors(id) on delete restrict,
  project_id uuid not null references projects(id) on delete restrict,
  purchase_category varchar(100),
  description text,
  amount numeric(18,3) not null check (amount > 0),
  document_ref varchar(100) not null,
  attachment_url text,
  attachment_name varchar(255),
  paid_amount numeric(18,3) default 0.000 check (paid_amount >= 0),
  outstanding_amount numeric(18,3) not null check (outstanding_amount >= 0),
  status varchar(20) default 'draft' check (status in ('draft','submitted','approved','rejected','posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_by_name varchar(255),
  approved_at timestamptz,
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists money_in (
  id uuid primary key default uuid_generate_v4(),
  transaction_date date not null,
  received_from varchar(255) not null,
  customer_id uuid references customers(id) on delete restrict,
  project_id uuid not null references projects(id) on delete restrict,
  against varchar(20) not null check (against in ('invoice','other')),
  invoice_id uuid references client_invoices(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  received_into varchar(20) not null check (received_into in ('bank','cash','petty_cash')),
  account_id uuid not null,
  document_ref varchar(100),
  attachment_url text,
  attachment_name varchar(255),
  status varchar(20) default 'draft' check (status in ('draft','submitted','approved','rejected','posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_by_name varchar(255),
  approved_at timestamptz,
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists money_out (
  id uuid primary key default uuid_generate_v4(),
  transaction_date date not null,
  paid_to varchar(255) not null,
  vendor_id uuid references vendors(id) on delete restrict,
  project_id uuid references projects(id) on delete restrict,
  payment_for varchar(20) not null check (payment_for in ('purchase','expense','other')),
  purchase_id uuid references purchases(id) on delete restrict,
  expense_head_id uuid references expense_heads(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  paid_from varchar(20) not null check (paid_from in ('bank','cash','petty_cash')),
  account_id uuid not null,
  document_ref varchar(100),
  attachment_url text,
  attachment_name varchar(255),
  status varchar(20) default 'draft' check (status in ('draft','submitted','approved','rejected','posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_by_name varchar(255),
  approved_at timestamptz,
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists direct_expenses (
  id uuid primary key default uuid_generate_v4(),
  expense_date date not null,
  project_id uuid not null references projects(id) on delete restrict,
  expense_head_id uuid not null references expense_heads(id) on delete restrict,
  description text not null,
  amount numeric(18,3) not null check (amount > 0),
  paid_from varchar(20) not null check (paid_from in ('bank','cash','petty_cash')),
  account_id uuid not null,
  document_ref varchar(100),
  attachment_url text,
  attachment_name varchar(255),
  status varchar(20) default 'draft' check (status in ('draft','submitted','approved','rejected','posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_by_name varchar(255),
  approved_at timestamptz,
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists transfers (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  transfer_from_type varchar(20) not null check (transfer_from_type in ('bank','cash','petty_cash')),
  transfer_from_id uuid not null,
  transfer_to_type varchar(20) not null check (transfer_to_type in ('bank','cash','petty_cash')),
  transfer_to_id uuid not null,
  amount numeric(18,3) not null check (amount > 0),
  document_ref varchar(100) not null,
  attachment_url text,
  attachment_name varchar(255),
  status varchar(20) default 'posted' check (status in ('draft','submitted','approved','rejected','posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists opening_balances (
  id uuid primary key default uuid_generate_v4(),
  account_type varchar(20) not null check (account_type in ('bank','cash','petty_cash','customer','vendor','other')),
  account_id uuid not null,
  opening_date date not null,
  amount numeric(18,3) not null,
  document_ref varchar(100),
  attachment_url text,
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------
-- 6. JOURNAL, AUDIT, ATTACHMENTS
-- ------------------------------------------------------------------
create table if not exists journal_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_number varchar(100) unique not null,
  date date not null,
  source_type varchar(50) not null,
  source_id uuid not null,
  project_id uuid references projects(id) on delete restrict,
  customer_id uuid references customers(id) on delete restrict,
  vendor_id uuid references vendors(id) on delete restrict,
  description text not null,
  debit_account varchar(100) not null,
  credit_account varchar(100) not null,
  amount numeric(18,3) not null check (amount > 0),
  debit_amount numeric(18,3) not null default 0.000 check (debit_amount >= 0),
  credit_amount numeric(18,3) not null default 0.000 check (credit_amount >= 0),
  status varchar(20) default 'posted' check (status in ('draft','posted','reversed')),
  created_at timestamptz default now(),
  constraint chk_journal_entry_audit_traceability check (
    source_type in ('transfer','opening') or
    (project_id is not null or customer_id is not null or vendor_id is not null)
  )
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  "timestamp" timestamptz default now(),
  user_id uuid references profiles(id),
  user_name varchar(255) not null,
  user_role varchar(50) not null,
  action varchar(100) not null,
  module varchar(100) not null,
  entity_type varchar(100),
  entity_id uuid,
  transaction_id uuid,
  document_ref varchar(100),
  reason text,
  old_value text,
  new_value text,
  old_values jsonb,
  new_values jsonb,
  details text not null,
  ip_address varchar(50)
);

create table if not exists attachments (
  id uuid primary key default uuid_generate_v4(),
  file_name varchar(255) not null,
  storage_path text not null,
  file_type varchar(100),
  file_size bigint,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now(),
  related_transaction_id uuid,
  related_transaction_type varchar(100),
  public_url text
);

insert into storage.buckets (id, name, public)
values ('construction_attachments', 'construction_attachments', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------------
-- 7. NOTIFICATIONS, DEMO REQUESTS, MASTER IMPORT AUDIT
-- ------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  title varchar(255) not null,
  message text not null,
  type varchar(50) not null,
  severity varchar(20) not null default 'info',
  "timestamp" timestamptz default now(),
  read boolean not null default false,
  link_view varchar(100),
  action_id varchar(100),
  entity_ref varchar(100),
  amount numeric(18,3),
  project_id uuid references projects(id)
);

create table if not exists demo_requests (
  id uuid primary key default uuid_generate_v4(),
  full_name varchar(255) not null,
  email varchar(255) not null,
  company_name varchar(255),
  phone varchar(50),
  role_code varchar(50) references roles(code),
  role_name varchar(100),
  purpose text,
  status varchar(20) not null default 'pending' check (status in ('pending','approved','rejected')),
  approval_token varchar(255) unique,
  requested_at timestamptz default now(),
  approved_at timestamptz,
  approval_link text,
  one_time_secure_link jsonb,
  assigned_credentials jsonb
);

create table if not exists master_import_audit (
  id uuid primary key default uuid_generate_v4(),
  import_type varchar(50) not null check (import_type in ('customers','vendors','projects','banks','expense_heads')),
  file_name varchar(255) not null,
  imported_by_user_id uuid references profiles(id),
  imported_by_user_name varchar(255),
  imported_by_user_email varchar(255),
  "timestamp" timestamptz default now(),
  total_rows integer not null default 0,
  new_records integer not null default 0,
  existing_records integer not null default 0,
  duplicate_records integer not null default 0,
  invalid_records integer not null default 0,
  skipped_records integer not null default 0,
  result varchar(20) not null check (result in ('success','partial','failed')),
  error_details text
);

-- ------------------------------------------------------------------
-- 8. INDEXES
-- ------------------------------------------------------------------
create index if not exists idx_projects_customer_id on projects(customer_id);
create index if not exists idx_client_invoices_customer_id on client_invoices(customer_id);
create index if not exists idx_client_invoices_project_id on client_invoices(project_id);
create index if not exists idx_client_invoices_date on client_invoices(date);
create index if not exists idx_client_invoices_status on client_invoices(status);
create index if not exists idx_purchases_vendor_id on purchases(vendor_id);
create index if not exists idx_purchases_project_id on purchases(project_id);
create index if not exists idx_purchases_date on purchases(date);
create index if not exists idx_purchases_status on purchases(status);
create index if not exists idx_money_in_customer_id on money_in(customer_id);
create index if not exists idx_money_in_project_id on money_in(project_id);
create index if not exists idx_money_in_invoice_id on money_in(invoice_id);
create index if not exists idx_money_out_vendor_id on money_out(vendor_id);
create index if not exists idx_money_out_project_id on money_out(project_id);
create index if not exists idx_money_out_purchase_id on money_out(purchase_id);
create index if not exists idx_money_out_expense_head_id on money_out(expense_head_id);
create index if not exists idx_direct_expenses_project_id on direct_expenses(project_id);
create index if not exists idx_direct_expenses_expense_head_id on direct_expenses(expense_head_id);
create index if not exists idx_journal_entries_project_id on journal_entries(project_id);
create index if not exists idx_journal_entries_customer_id on journal_entries(customer_id);
create index if not exists idx_journal_entries_vendor_id on journal_entries(vendor_id);
create index if not exists idx_journal_entries_date on journal_entries(date);
create index if not exists idx_journal_entries_source on journal_entries(source_type, source_id);
create index if not exists idx_audit_logs_transaction_id on audit_logs(transaction_id);
create index if not exists idx_audit_logs_timestamp on audit_logs("timestamp");
create index if not exists idx_attachments_related_transaction_id on attachments(related_transaction_id);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_profiles_role_code on profiles(role_code);

-- ==============================================================================
-- 9. AUTHORIZATION HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- ==============================================================================
create or replace function current_role_code()
returns varchar language sql stable security definer set search_path = public as $$
  select role_code from profiles where id = auth.uid() and status = 'active';
$$;

create or replace function has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select perm = any(r.permissions)
     from profiles p join roles r on r.code = p.role_code
     where p.id = auth.uid() and p.status = 'active'),
    false
  );
$$;

create or replace function can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_all_projects from profiles p where p.id = auth.uid() and p.status = 'active'),
    false
  )
  or exists (
    select 1 from user_project_assignments upa
    where upa.user_id = auth.uid() and upa.project_id = p_project_id
  );
$$;

create or replace function is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY
-- ==============================================================================
alter table roles enable row level security;
alter table profiles enable row level security;
alter table user_project_assignments enable row level security;
alter table workflow_settings enable row level security;
alter table approval_limits enable row level security;
alter table customers enable row level security;
alter table vendors enable row level security;
alter table projects enable row level security;
alter table bank_accounts enable row level security;
alter table cash_accounts enable row level security;
alter table petty_cash_accounts enable row level security;
alter table expense_heads enable row level security;
alter table client_invoices enable row level security;
alter table purchases enable row level security;
alter table money_in enable row level security;
alter table money_out enable row level security;
alter table direct_expenses enable row level security;
alter table transfers enable row level security;
alter table opening_balances enable row level security;
alter table journal_entries enable row level security;
alter table audit_logs enable row level security;
alter table attachments enable row level security;
alter table notifications enable row level security;
alter table demo_requests enable row level security;
alter table master_import_audit enable row level security;

-- roles: any active user can read; only users.edit/roles.edit can write
create policy "roles_select" on roles for select using (is_active_user());
create policy "roles_write" on roles for all using (has_permission('roles.edit') or has_permission('roles.create'))
  with check (has_permission('roles.edit') or has_permission('roles.create'));

-- profiles: self read, or users.view permission; self-limited update, or users.edit permission
create policy "profiles_select_self_or_admin" on profiles for select
  using (id = auth.uid() or has_permission('users.view'));
create policy "profiles_insert_admin" on profiles for insert
  with check (has_permission('users.create'));
create policy "profiles_update_self_or_admin" on profiles for update
  using (id = auth.uid() or has_permission('users.edit'))
  with check (id = auth.uid() or has_permission('users.edit'));

create policy "upa_select" on user_project_assignments for select using (is_active_user());
create policy "upa_write" on user_project_assignments for all
  using (has_permission('users.edit')) with check (has_permission('users.edit'));

create policy "workflow_settings_select" on workflow_settings for select using (is_active_user());
create policy "workflow_settings_write" on workflow_settings for all
  using (has_permission('settings.edit')) with check (has_permission('settings.edit'));

create policy "approval_limits_select" on approval_limits for select using (is_active_user());
create policy "approval_limits_write" on approval_limits for all
  using (has_permission('settings.edit')) with check (has_permission('settings.edit'));

-- master data: broad read for active users, gated write per module
create policy "customers_select" on customers for select using (is_active_user());
create policy "customers_insert" on customers for insert with check (has_permission('customers.create'));
create policy "customers_update" on customers for update
  using (has_permission('customers.edit')) with check (has_permission('customers.edit'));

create policy "vendors_select" on vendors for select using (is_active_user());
create policy "vendors_insert" on vendors for insert with check (has_permission('vendors.create'));
create policy "vendors_update" on vendors for update
  using (has_permission('vendors.edit')) with check (has_permission('vendors.edit'));

create policy "projects_select" on projects for select
  using (has_permission('projects.view') and can_access_project(id));
create policy "projects_insert" on projects for insert with check (has_permission('projects.create'));
create policy "projects_update" on projects for update
  using (has_permission('projects.edit') and can_access_project(id))
  with check (has_permission('projects.edit'));

create policy "bank_accounts_select" on bank_accounts for select using (has_permission('bank_accounts.view'));
create policy "bank_accounts_insert" on bank_accounts for insert with check (has_permission('bank_accounts.create'));
create policy "bank_accounts_update" on bank_accounts for update
  using (has_permission('bank_accounts.edit')) with check (has_permission('bank_accounts.edit'));

create policy "cash_accounts_select" on cash_accounts for select using (has_permission('cash.view'));
create policy "cash_accounts_write" on cash_accounts for all
  using (has_permission('treasury.view') and has_permission('settings.edit'))
  with check (has_permission('settings.edit'));

create policy "petty_cash_accounts_select" on petty_cash_accounts for select using (has_permission('petty_cash.view'));
create policy "petty_cash_accounts_write" on petty_cash_accounts for all
  using (has_permission('treasury.view') and has_permission('settings.edit'))
  with check (has_permission('settings.edit'));

create policy "expense_heads_select" on expense_heads for select using (is_active_user());
create policy "expense_heads_write" on expense_heads for all
  using (has_permission('expenses.view') and has_permission('settings.edit'))
  with check (has_permission('settings.edit'));

-- transactional tables: view + project scope; create; edit only own drafts; approve/post via RPC below
create policy "client_invoices_select" on client_invoices for select
  using (has_permission('invoices.view') and can_access_project(project_id));
create policy "client_invoices_insert" on client_invoices for insert
  with check (has_permission('invoices.create') and can_access_project(project_id) and created_by = auth.uid());
create policy "client_invoices_update_draft" on client_invoices for update
  using (has_permission('invoices.edit') and status = 'draft' and created_by = auth.uid())
  with check (status = 'draft');

create policy "purchases_select" on purchases for select
  using (has_permission('purchases.view') and can_access_project(project_id));
create policy "purchases_insert" on purchases for insert
  with check (has_permission('purchases.create') and can_access_project(project_id) and created_by = auth.uid());
create policy "purchases_update_draft" on purchases for update
  using (has_permission('purchases.edit') and status = 'draft' and created_by = auth.uid())
  with check (status = 'draft');

create policy "money_in_select" on money_in for select
  using (has_permission('money_in.view') and can_access_project(project_id));
create policy "money_in_insert" on money_in for insert
  with check (has_permission('money_in.create') and can_access_project(project_id) and created_by = auth.uid());
create policy "money_in_update_draft" on money_in for update
  using (has_permission('money_in.edit') and status = 'draft' and created_by = auth.uid())
  with check (status = 'draft');

create policy "money_out_select" on money_out for select
  using (has_permission('money_out.view'));
create policy "money_out_insert" on money_out for insert
  with check (has_permission('money_out.create') and created_by = auth.uid());
create policy "money_out_update_draft" on money_out for update
  using (has_permission('money_out.edit') and status = 'draft' and created_by = auth.uid())
  with check (status = 'draft');

create policy "direct_expenses_select" on direct_expenses for select
  using (has_permission('expenses.view') and can_access_project(project_id));
create policy "direct_expenses_insert" on direct_expenses for insert
  with check (has_permission('expenses.create') and can_access_project(project_id) and created_by = auth.uid());
create policy "direct_expenses_update_draft" on direct_expenses for update
  using (has_permission('expenses.edit') and status = 'draft' and created_by = auth.uid())
  with check (status = 'draft');

create policy "transfers_select" on transfers for select using (has_permission('treasury.view'));
create policy "transfers_insert" on transfers for insert
  with check (has_permission('transfers.create') and created_by = auth.uid());

create policy "opening_balances_select" on opening_balances for select using (is_active_user());
create policy "opening_balances_insert" on opening_balances for insert with check (has_permission('settings.edit'));

create policy "journal_entries_select" on journal_entries for select using (has_permission('reports.view'));
-- journal_entries are written exclusively by SECURITY DEFINER functions below (service role bypasses RLS anyway)

create policy "audit_logs_select" on audit_logs for select using (has_permission('audit.view'));
create policy "audit_logs_insert" on audit_logs for insert with check (is_active_user());

create policy "attachments_select" on attachments for select using (has_permission('documents.view'));
create policy "attachments_insert" on attachments for insert with check (has_permission('documents.upload'));
create policy "attachments_delete" on attachments for delete using (has_permission('documents.delete'));

create policy "notifications_select" on notifications for select using (user_id = auth.uid() or user_id is null);
create policy "notifications_update_own" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert" on notifications for insert with check (is_active_user());

-- demo_requests: unauthenticated inserts allowed (public request-a-demo form), admin-only read/approve
create policy "demo_requests_insert_public" on demo_requests for insert with check (true);
create policy "demo_requests_select_admin" on demo_requests for select using (has_permission('users.create'));
create policy "demo_requests_update_admin" on demo_requests for update
  using (has_permission('users.create')) with check (has_permission('users.create'));

create policy "master_import_audit_select" on master_import_audit for select using (has_permission('audit.view'));
create policy "master_import_audit_insert" on master_import_audit for insert with check (has_permission('master_data.import'));

-- ==============================================================================
-- 11. SERVER-ENFORCED APPROVAL WORKFLOW (fixes client-only authorization)
-- Generalized state-transition RPC covering the five approval-driven modules.
-- Enforces: permission for the action, separation-of-duties, and approval limits.
-- ==============================================================================
create or replace function transition_transaction(
  p_module text,           -- 'invoices' | 'purchases' | 'money_in' | 'money_out' | 'expenses'
  p_id uuid,
  p_action text,            -- 'submit' | 'approve' | 'reject' | 'post' | 'reverse'
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_perm text;
  v_current_status text;
  v_new_status text;
  v_amount numeric;
  v_created_by uuid;
  v_limit numeric;
  v_sod_enabled boolean;
begin
  v_table := case p_module
    when 'invoices' then 'client_invoices'
    when 'purchases' then 'purchases'
    when 'money_in' then 'money_in'
    when 'money_out' then 'money_out'
    when 'expenses' then 'direct_expenses'
    else null
  end;
  if v_table is null then
    raise exception 'Unknown module %', p_module;
  end if;

  v_perm := p_module || '.' || p_action;
  if not has_permission(v_perm) then
    raise exception 'Permission denied: %', v_perm;
  end if;

  execute format('select amount, created_by, status from %I where id = $1', v_table)
    into v_amount, v_created_by, v_current_status using p_id;

  if v_amount is null then
    raise exception '% record % not found', v_table, p_id;
  end if;

  select separation_of_duties_enabled into v_sod_enabled from workflow_settings where id = true;

  if p_action = 'approve' then
    if coalesce(v_sod_enabled, true) and v_created_by = auth.uid() then
      raise exception 'Separation of duties: creator cannot approve own transaction';
    end if;
    select max_amount_omr into v_limit from approval_limits where role_code = current_role_code();
    if v_limit is not null and v_amount > v_limit then
      raise exception 'Approval limit exceeded for role %: limit % OMR, amount % OMR', current_role_code(), v_limit, v_amount;
    end if;
  end if;

  v_new_status := case p_action
    when 'submit' then 'submitted'
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'post' then 'posted'
    when 'reverse' then 'reversed'
    else null
  end;
  if v_new_status is null then
    raise exception 'Unknown action %', p_action;
  end if;

  execute format(
    'update %I set status = $1,
      submitted_by = case when $2 = ''submitted'' then auth.uid() else submitted_by end,
      submitted_at = case when $2 = ''submitted'' then now() else submitted_at end,
      approved_by = case when $2 = ''approved'' then auth.uid() else approved_by end,
      approved_at = case when $2 = ''approved'' then now() else approved_at end,
      posted_by = case when $2 = ''posted'' then auth.uid() else posted_by end,
      posted_at = case when $2 = ''posted'' then now() else posted_at end,
      rejection_reason = case when $2 = ''rejected'' then $3 else rejection_reason end
    where id = $4', v_table)
    using v_new_status, v_new_status, p_reason, p_id;

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, details)
  values (
    auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'unknown'),
    coalesce(current_role_code(), 'unknown'),
    p_action,
    p_module,
    p_id,
    format('%s transaction %s -> %s', p_module, p_id, v_new_status)
  );
end;
$$;

revoke all on function transition_transaction(text, uuid, text, text) from public;
grant execute on function transition_transaction(text, uuid, text, text) to authenticated;

-- ==============================================================================
-- 12. AUTO-CREATE PROFILE ON SIGNUP (default role: viewer until promoted)
-- ==============================================================================
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role_code, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role_code', 'viewer'),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
