-- ==============================================================================
-- BUSINESS PARTNERS: master data for funds movement with parties that are
-- neither Customers (receivables) nor Vendors (payables) — e.g. directors,
-- shareholders, related/group companies, JV partners, intercompany accounts.
--
-- Modeled as a fourth treasury-account type (alongside bank/cash/petty_cash)
-- so it reuses the existing, already-proven Transfer mechanism (transfers
-- table, create_transfer RPC, adjust_account_balance, reverse_transaction)
-- instead of duplicating that logic in a parallel transaction type.
-- ==============================================================================

create table if not exists business_partners (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) unique not null,
  name varchar(255) not null,
  partner_type varchar(100) not null default 'Other',
  contact_person varchar(255),
  phone varchar(50),
  email varchar(255),
  address text,
  opening_balance numeric(18,3) default 0.000,
  current_balance numeric(18,3) default 0.000,
  status varchar(20) default 'active' check (status in ('active','inactive')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table business_partners enable row level security;

create policy "business_partners_select" on business_partners for select using (is_active_user());
create policy "business_partners_insert" on business_partners for insert with check (has_permission('business_partners.create'));
create policy "business_partners_update" on business_partners for update
  using (has_permission('business_partners.edit')) with check (has_permission('business_partners.edit'));

-- Allow 'partner' as a transfer endpoint alongside bank/cash/petty_cash.
alter table transfers drop constraint if exists transfers_transfer_from_type_check;
alter table transfers add constraint transfers_transfer_from_type_check
  check (transfer_from_type in ('bank','cash','petty_cash','partner'));

alter table transfers drop constraint if exists transfers_transfer_to_type_check;
alter table transfers add constraint transfers_transfer_to_type_check
  check (transfer_to_type in ('bank','cash','petty_cash','partner'));

-- Teach the shared balance-adjustment RPC (used by create_transfer and
-- reverse_transaction alike) how to post against a business partner.
create or replace function adjust_account_balance(p_account_type text, p_account_id uuid, p_delta numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_active_user() then
    raise exception 'Unauthorized';
  end if;

  if p_account_type = 'bank' then
    update bank_accounts set current_balance = current_balance + p_delta, updated_at = now() where id = p_account_id;
  elsif p_account_type = 'cash' then
    update cash_accounts set current_balance = current_balance + p_delta, updated_at = now() where id = p_account_id;
  elsif p_account_type = 'petty_cash' then
    update petty_cash_accounts set current_balance = current_balance + p_delta, updated_at = now() where id = p_account_id;
  elsif p_account_type = 'partner' then
    update business_partners set current_balance = current_balance + p_delta, updated_at = now() where id = p_account_id;
  else
    raise exception 'Unknown account type %', p_account_type;
  end if;
end;
$$;

-- Allow bulk import of Business Partners via the same master-data import path.
alter table master_import_audit drop constraint if exists master_import_audit_import_type_check;
alter table master_import_audit add constraint master_import_audit_import_type_check
  check (import_type in ('customers','vendors','projects','banks','expense_heads','business_partners'));

-- Grant the new business_partners.* permissions to the roles that already
-- perform treasury transfers (super_admin, accounts_manager, finance_manager,
-- accountant, treasury_user), plus read-only for viewer. Idempotent via
-- array(select distinct unnest(...)) so re-running this migration is safe.
update roles set permissions = array(
  select distinct unnest(permissions || array['business_partners.view','business_partners.create','business_partners.edit','business_partners.export'])
) where code in ('super_admin','accounts_manager','finance_manager');

update roles set permissions = array(
  select distinct unnest(permissions || array['business_partners.view','business_partners.create','business_partners.edit'])
) where code in ('accountant','treasury_user');

update roles set permissions = array(
  select distinct unnest(permissions || array['business_partners.view'])
) where code = 'viewer';
