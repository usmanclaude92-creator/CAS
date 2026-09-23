-- ==============================================================================
-- VAT PHASE 1: transaction-level VAT capture (Oman, 5% standard rate)
--
-- Adds net_amount / vat_rate / vat_amount / vat_treatment to the three
-- primary revenue/cost transaction tables. `amount` keeps its existing
-- meaning (VAT-inclusive gross total) and continues to drive
-- outstanding/received/paid balances exactly as before — zero behavior
-- change there. `net_amount` (amount excl. VAT) is new, for VAT-return
-- reporting; existing rows are backfilled with net_amount = amount,
-- vat_rate = 0, vat_amount = 0, vat_treatment = 'out_of_scope', so
-- nothing already posted is reinterpreted as carrying VAT it never had.
-- ==============================================================================

do $$
begin
  -- CLIENT INVOICES (Output VAT)
  alter table client_invoices add column if not exists net_amount numeric(18,3);
  alter table client_invoices add column if not exists vat_rate numeric(5,2) not null default 0;
  alter table client_invoices add column if not exists vat_amount numeric(18,3) not null default 0;
  alter table client_invoices add column if not exists vat_treatment varchar(20) not null default 'out_of_scope';
  update client_invoices set net_amount = amount where net_amount is null;
  alter table client_invoices alter column net_amount set not null;
  alter table client_invoices alter column net_amount set default 0;

  -- PURCHASES (Input VAT, incl. reverse charge on non-resident services)
  alter table purchases add column if not exists net_amount numeric(18,3);
  alter table purchases add column if not exists vat_rate numeric(5,2) not null default 0;
  alter table purchases add column if not exists vat_amount numeric(18,3) not null default 0;
  alter table purchases add column if not exists vat_treatment varchar(20) not null default 'out_of_scope';
  update purchases set net_amount = amount where net_amount is null;
  alter table purchases alter column net_amount set not null;
  alter table purchases alter column net_amount set default 0;

  -- DIRECT EXPENSES (Input VAT)
  alter table direct_expenses add column if not exists net_amount numeric(18,3);
  alter table direct_expenses add column if not exists vat_rate numeric(5,2) not null default 0;
  alter table direct_expenses add column if not exists vat_amount numeric(18,3) not null default 0;
  alter table direct_expenses add column if not exists vat_treatment varchar(20) not null default 'out_of_scope';
  update direct_expenses set net_amount = amount where net_amount is null;
  alter table direct_expenses alter column net_amount set not null;
  alter table direct_expenses alter column net_amount set default 0;
end $$;

alter table client_invoices drop constraint if exists client_invoices_vat_treatment_check;
alter table client_invoices add constraint client_invoices_vat_treatment_check
  check (vat_treatment in ('standard','zero_rated','exempt','out_of_scope'));

alter table purchases drop constraint if exists purchases_vat_treatment_check;
alter table purchases add constraint purchases_vat_treatment_check
  check (vat_treatment in ('standard','zero_rated','exempt','out_of_scope','reverse_charge'));

alter table direct_expenses drop constraint if exists direct_expenses_vat_treatment_check;
alter table direct_expenses add constraint direct_expenses_vat_treatment_check
  check (vat_treatment in ('standard','zero_rated','exempt','out_of_scope','reverse_charge'));

-- ==============================================================================
-- Re-create the three posting RPCs to store the new VAT fields and split the
-- journal entry into a net revenue/cost leg + a VAT leg (Output VAT Payable
-- for invoices, Input VAT Receivable for purchases/expenses) whenever
-- vat_amount > 0, instead of one undifferentiated line. Everything else
-- (permission checks, balance/outstanding updates, audit logging) is
-- unchanged from the prior definitions.
-- ==============================================================================

create or replace function create_client_invoice(payload jsonb)
returns client_invoices
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_vat_amount numeric := coalesce((payload->>'vatAmount')::numeric, 0);
  v_row client_invoices;
begin
  if not has_permission('invoices.create') then raise exception 'Permission denied: invoices.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  insert into client_invoices (
    invoice_type, invoice_number, date, customer_id, project_id, description, amount,
    net_amount, vat_rate, vat_amount, vat_treatment,
    document_ref, attachment_url, attachment_name, received_amount, outstanding_amount,
    status, remarks, created_by, created_by_name
  ) values (
    payload->>'invoiceType', payload->>'invoiceNumber', (payload->>'date')::date,
    (payload->>'customerId')::uuid, v_project_id, payload->>'description',
    (payload->>'amount')::numeric,
    (payload->>'netAmount')::numeric, coalesce((payload->>'vatRate')::numeric, 0), v_vat_amount,
    coalesce(payload->>'vatTreatment', 'out_of_scope'),
    payload->>'documentRef', payload->>'attachmentUrl',
    payload->>'attachmentName', 0, (payload->>'amount')::numeric, 'posted',
    payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, customer_id, description, debit_account, credit_account, amount)
  values (
    payload->>'entryNumber', v_row.date, 'invoice', v_row.id, v_row.project_id, v_row.customer_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_row.net_amount
  );

  if v_vat_amount > 0 then
    insert into journal_entries (entry_number, date, source_type, source_id, project_id, customer_id, description, debit_account, credit_account, amount)
    values (
      payload->>'entryNumber' || '-VAT', v_row.date, 'invoice', v_row.id, v_row.project_id, v_row.customer_id,
      coalesce(payload->>'journalDescription', '') || ' - Output VAT', payload->>'debitAccount', 'Output VAT Payable', v_vat_amount
    );
  end if;

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'CREATE_CLIENT_INVOICE', 'Invoices & IPC', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function create_purchase(payload jsonb)
returns purchases
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_vat_amount numeric := coalesce((payload->>'vatAmount')::numeric, 0);
  v_vat_treatment text := coalesce(payload->>'vatTreatment', 'out_of_scope');
  v_row purchases;
begin
  if not has_permission('purchases.create') then raise exception 'Permission denied: purchases.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  insert into purchases (
    purchase_invoice_number, date, vendor_id, project_id, purchase_category, description, amount,
    net_amount, vat_rate, vat_amount, vat_treatment,
    document_ref, attachment_url, attachment_name, paid_amount, outstanding_amount, status, remarks,
    created_by, created_by_name
  ) values (
    payload->>'purchaseInvoiceNumber', (payload->>'date')::date, (payload->>'vendorId')::uuid, v_project_id,
    payload->>'purchaseCategory', payload->>'description', (payload->>'amount')::numeric,
    (payload->>'netAmount')::numeric, coalesce((payload->>'vatRate')::numeric, 0), v_vat_amount, v_vat_treatment,
    payload->>'documentRef',
    payload->>'attachmentUrl', payload->>'attachmentName', 0, (payload->>'amount')::numeric, 'posted',
    payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.date, 'purchase', v_row.id, v_row.project_id, v_row.vendor_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_row.net_amount);

  if v_vat_amount > 0 and v_vat_treatment = 'reverse_charge' then
    -- Self-charged: no VAT on the vendor's own bill, so Accounts Payable to
    -- the vendor is untouched. Declare both the input and output legs.
    insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
    values (payload->>'entryNumber' || '-VAT', v_row.date, 'purchase', v_row.id, v_row.project_id, v_row.vendor_id,
      coalesce(payload->>'journalDescription', '') || ' - Reverse Charge VAT', 'Input VAT Receivable (RCM)', 'Output VAT Payable (RCM Self-Charge)', v_vat_amount);
  elsif v_vat_amount > 0 then
    insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
    values (payload->>'entryNumber' || '-VAT', v_row.date, 'purchase', v_row.id, v_row.project_id, v_row.vendor_id,
      coalesce(payload->>'journalDescription', '') || ' - Input VAT', 'Input VAT Receivable', payload->>'creditAccount', v_vat_amount);
  end if;

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'CREATE_PURCHASE', 'Purchases & Payables', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function create_direct_expense(payload jsonb)
returns direct_expenses
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_amount numeric := (payload->>'amount')::numeric;
  v_vat_amount numeric := coalesce((payload->>'vatAmount')::numeric, 0);
  v_vat_treatment text := coalesce(payload->>'vatTreatment', 'out_of_scope');
  v_row direct_expenses;
begin
  if not has_permission('expenses.create') then raise exception 'Permission denied: expenses.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  insert into direct_expenses (
    expense_date, project_id, expense_head_id, description, amount,
    net_amount, vat_rate, vat_amount, vat_treatment,
    paid_from, account_id,
    document_ref, attachment_url, attachment_name, status, remarks, created_by, created_by_name
  ) values (
    (payload->>'expenseDate')::date, v_project_id, (payload->>'expenseHeadId')::uuid, payload->>'description',
    v_amount, (payload->>'netAmount')::numeric, coalesce((payload->>'vatRate')::numeric, 0), v_vat_amount, v_vat_treatment,
    payload->>'paidFrom', (payload->>'accountId')::uuid, payload->>'documentRef',
    payload->>'attachmentUrl', payload->>'attachmentName', 'posted', payload->>'remarks',
    auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  perform adjust_account_balance(payload->>'paidFrom', (payload->>'accountId')::uuid, -v_amount);

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.expense_date, 'expense', v_row.id, v_row.project_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_row.net_amount);

  if v_vat_amount > 0 and v_vat_treatment = 'reverse_charge' then
    insert into journal_entries (entry_number, date, source_type, source_id, project_id, description, debit_account, credit_account, amount)
    values (payload->>'entryNumber' || '-VAT', v_row.expense_date, 'expense', v_row.id, v_row.project_id,
      coalesce(payload->>'journalDescription', '') || ' - Reverse Charge VAT', 'Input VAT Receivable (RCM)', 'Output VAT Payable (RCM Self-Charge)', v_vat_amount);
  elsif v_vat_amount > 0 then
    insert into journal_entries (entry_number, date, source_type, source_id, project_id, description, debit_account, credit_account, amount)
    values (payload->>'entryNumber' || '-VAT', v_row.expense_date, 'expense', v_row.id, v_row.project_id,
      coalesce(payload->>'journalDescription', '') || ' - Input VAT', 'Input VAT Receivable', payload->>'creditAccount', v_vat_amount);
  end if;

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'RECORD_EXPENSE', 'Expenses', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

revoke all on function create_client_invoice(jsonb) from public, anon, authenticated;
revoke all on function create_purchase(jsonb) from public, anon, authenticated;
revoke all on function create_direct_expense(jsonb) from public, anon, authenticated;

grant execute on function create_client_invoice(jsonb) to authenticated;
grant execute on function create_purchase(jsonb) to authenticated;
grant execute on function create_direct_expense(jsonb) to authenticated;
