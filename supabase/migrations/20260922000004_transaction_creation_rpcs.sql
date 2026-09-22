-- ==============================================================================
-- ATOMIC TRANSACTION-CREATION RPCs
-- Each transactional create (invoice, purchase, receipt, payment, expense,
-- transfer) touches more than one table (the transaction row itself, a linked
-- running-total on another row, an account balance, a journal entry, and an
-- audit log). Doing this as separate client-side REST calls would require
-- RLS UPDATE policies broad enough to let any creator edit other people's
-- posted invoices/purchases/balances — a hole. Instead each operation is a
-- single SECURITY DEFINER RPC that checks permission + project scope itself
-- and performs every side effect atomically.
-- ==============================================================================

create or replace function create_client_invoice(payload jsonb)
returns client_invoices
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_row client_invoices;
begin
  if not has_permission('invoices.create') then raise exception 'Permission denied: invoices.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  insert into client_invoices (
    invoice_type, invoice_number, date, customer_id, project_id, description, amount,
    document_ref, attachment_url, attachment_name, received_amount, outstanding_amount,
    status, remarks, created_by, created_by_name
  ) values (
    payload->>'invoiceType', payload->>'invoiceNumber', (payload->>'date')::date,
    (payload->>'customerId')::uuid, v_project_id, payload->>'description',
    (payload->>'amount')::numeric, payload->>'documentRef', payload->>'attachmentUrl',
    payload->>'attachmentName', 0, (payload->>'amount')::numeric, 'posted',
    payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, customer_id, description, debit_account, credit_account, amount)
  values (
    payload->>'entryNumber', v_row.date, 'invoice', v_row.id, v_row.project_id, v_row.customer_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_row.amount
  );

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'CREATE_CLIENT_INVOICE', 'Invoices & IPC', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function record_money_in(payload jsonb)
returns money_in
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_invoice_id uuid := nullif(payload->>'invoiceId', '')::uuid;
  v_amount numeric := (payload->>'amount')::numeric;
  v_row money_in;
  v_invoice client_invoices;
begin
  if not has_permission('money_in.create') then raise exception 'Permission denied: money_in.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  if v_invoice_id is not null then
    select * into v_invoice from client_invoices where id = v_invoice_id;
    if v_invoice.id is null then raise exception 'Selected invoice not found.'; end if;
    if v_invoice.status = 'reversed' then raise exception 'Cannot apply payment to a reversed invoice.'; end if;
    if v_amount > v_invoice.outstanding_amount then
      raise exception 'Payment amount exceeds invoice outstanding balance.';
    end if;
  end if;

  insert into money_in (
    transaction_date, received_from, customer_id, project_id, against, invoice_id, amount,
    received_into, account_id, document_ref, attachment_url, attachment_name, status, remarks,
    created_by, created_by_name
  ) values (
    (payload->>'transactionDate')::date, payload->>'receivedFrom', nullif(payload->>'customerId','')::uuid,
    v_project_id, payload->>'against', v_invoice_id, v_amount, payload->>'receivedInto',
    (payload->>'accountId')::uuid, payload->>'documentRef', payload->>'attachmentUrl', payload->>'attachmentName',
    'posted', payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  perform adjust_account_balance(payload->>'receivedInto', (payload->>'accountId')::uuid, v_amount);

  if v_invoice_id is not null then
    update client_invoices set
      received_amount = received_amount + v_amount,
      outstanding_amount = amount - (received_amount + v_amount)
    where id = v_invoice_id;
  end if;

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, customer_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.transaction_date, 'money_in', v_row.id, v_row.project_id, v_row.customer_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_amount);

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'RECORD_MONEY_IN', 'Banking & Treasury', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function create_purchase(payload jsonb)
returns purchases
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_row purchases;
begin
  if not has_permission('purchases.create') then raise exception 'Permission denied: purchases.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  insert into purchases (
    purchase_invoice_number, date, vendor_id, project_id, purchase_category, description, amount,
    document_ref, attachment_url, attachment_name, paid_amount, outstanding_amount, status, remarks,
    created_by, created_by_name
  ) values (
    payload->>'purchaseInvoiceNumber', (payload->>'date')::date, (payload->>'vendorId')::uuid, v_project_id,
    payload->>'purchaseCategory', payload->>'description', (payload->>'amount')::numeric, payload->>'documentRef',
    payload->>'attachmentUrl', payload->>'attachmentName', 0, (payload->>'amount')::numeric, 'posted',
    payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.date, 'purchase', v_row.id, v_row.project_id, v_row.vendor_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_row.amount);

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'CREATE_PURCHASE', 'Purchases & Payables', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function record_money_out(payload jsonb)
returns money_out
language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric := (payload->>'amount')::numeric;
  v_purchase_id uuid := nullif(payload->>'purchaseId', '')::uuid;
  v_row money_out;
  v_purchase purchases;
begin
  if not has_permission('money_out.create') then raise exception 'Permission denied: money_out.create'; end if;

  if v_purchase_id is not null then
    select * into v_purchase from purchases where id = v_purchase_id;
    if v_purchase.id is null then raise exception 'Selected purchase invoice not found.'; end if;
    if v_purchase.status = 'reversed' then raise exception 'Cannot pay against a reversed purchase.'; end if;
    if v_amount > v_purchase.outstanding_amount then
      raise exception 'Payment amount exceeds purchase outstanding balance.';
    end if;
  end if;

  insert into money_out (
    transaction_date, paid_to, vendor_id, project_id, payment_for, purchase_id, expense_head_id, amount,
    paid_from, account_id, document_ref, attachment_url, attachment_name, status, remarks,
    created_by, created_by_name
  ) values (
    (payload->>'transactionDate')::date, payload->>'paidTo', nullif(payload->>'vendorId','')::uuid,
    nullif(payload->>'projectId','')::uuid, payload->>'paymentFor', v_purchase_id,
    nullif(payload->>'expenseHeadId','')::uuid, v_amount, payload->>'paidFrom', (payload->>'accountId')::uuid,
    payload->>'documentRef', payload->>'attachmentUrl', payload->>'attachmentName', 'posted', payload->>'remarks',
    auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  perform adjust_account_balance(payload->>'paidFrom', (payload->>'accountId')::uuid, -v_amount);

  if v_purchase_id is not null then
    update purchases set
      paid_amount = paid_amount + v_amount,
      outstanding_amount = amount - (paid_amount + v_amount)
    where id = v_purchase_id;
  end if;

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.transaction_date, 'money_out', v_row.id, v_row.project_id, v_row.vendor_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_amount);

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'RECORD_MONEY_OUT', 'Purchases & Payables', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function create_direct_expense(payload jsonb)
returns direct_expenses
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_amount numeric := (payload->>'amount')::numeric;
  v_row direct_expenses;
begin
  if not has_permission('expenses.create') then raise exception 'Permission denied: expenses.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  insert into direct_expenses (
    expense_date, project_id, expense_head_id, description, amount, paid_from, account_id,
    document_ref, attachment_url, attachment_name, status, remarks, created_by, created_by_name
  ) values (
    (payload->>'expenseDate')::date, v_project_id, (payload->>'expenseHeadId')::uuid, payload->>'description',
    v_amount, payload->>'paidFrom', (payload->>'accountId')::uuid, payload->>'documentRef',
    payload->>'attachmentUrl', payload->>'attachmentName', 'posted', payload->>'remarks',
    auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  perform adjust_account_balance(payload->>'paidFrom', (payload->>'accountId')::uuid, -v_amount);

  insert into journal_entries (entry_number, date, source_type, source_id, project_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.expense_date, 'expense', v_row.id, v_row.project_id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_amount);

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'RECORD_EXPENSE', 'Expenses', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function create_transfer(payload jsonb)
returns transfers
language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric := (payload->>'amount')::numeric;
  v_row transfers;
begin
  if not has_permission('transfers.create') then raise exception 'Permission denied: transfers.create'; end if;

  insert into transfers (
    date, transfer_from_type, transfer_from_id, transfer_to_type, transfer_to_id, amount,
    document_ref, attachment_url, attachment_name, status, remarks, created_by, created_by_name
  ) values (
    (payload->>'date')::date, payload->>'transferFromType', (payload->>'transferFromId')::uuid,
    payload->>'transferToType', (payload->>'transferToId')::uuid, v_amount, payload->>'documentRef',
    payload->>'attachmentUrl', payload->>'attachmentName', 'posted', payload->>'remarks',
    auth.uid(), (select full_name from profiles where id = auth.uid())
  ) returning * into v_row;

  perform adjust_account_balance(payload->>'transferFromType', (payload->>'transferFromId')::uuid, -v_amount);
  perform adjust_account_balance(payload->>'transferToType', (payload->>'transferToId')::uuid, v_amount);

  insert into journal_entries (entry_number, date, source_type, source_id, description, debit_account, credit_account, amount)
  values (payload->>'entryNumber', v_row.date, 'transfer', v_row.id,
    payload->>'journalDescription', payload->>'debitAccount', payload->>'creditAccount', v_amount);

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'RECORD_TRANSFER', 'Banking & Treasury', v_row.id, v_row.document_ref, payload->>'auditDetails');

  return v_row;
end;
$$;

create or replace function set_opening_balance(payload jsonb)
returns opening_balances
language plpgsql security definer set search_path = public as $$
declare
  v_account_type text := payload->>'accountType';
  v_account_id uuid := (payload->>'accountId')::uuid;
  v_amount numeric := (payload->>'amount')::numeric;
  v_row opening_balances;
begin
  if not has_permission('settings.edit') then raise exception 'Permission denied: settings.edit'; end if;

  if v_account_type = 'bank' then
    update bank_accounts set opening_balance = v_amount, current_balance = v_amount where id = v_account_id;
  elsif v_account_type = 'cash' then
    update cash_accounts set opening_balance = v_amount, current_balance = v_amount where id = v_account_id;
  elsif v_account_type = 'petty_cash' then
    update petty_cash_accounts set opening_balance = v_amount, current_balance = v_amount where id = v_account_id;
  elsif v_account_type = 'customer' then
    update customers set opening_balance = v_amount where id = v_account_id;
  elsif v_account_type = 'vendor' then
    update vendors set opening_balance = v_amount where id = v_account_id;
  end if;

  insert into opening_balances (account_type, account_id, opening_date, amount, document_ref, remarks, created_by)
  values (v_account_type, v_account_id, (payload->>'openingDate')::date, v_amount, payload->>'documentRef', payload->>'remarks', auth.uid())
  returning * into v_row;

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
    'SET_OPENING_BALANCE', 'Masters & Settings', v_row.id, payload->>'documentRef', payload->>'auditDetails');

  return v_row;
end;
$$;

revoke all on function create_client_invoice(jsonb) from public, anon, authenticated;
revoke all on function record_money_in(jsonb) from public, anon, authenticated;
revoke all on function create_purchase(jsonb) from public, anon, authenticated;
revoke all on function record_money_out(jsonb) from public, anon, authenticated;
revoke all on function create_direct_expense(jsonb) from public, anon, authenticated;
revoke all on function create_transfer(jsonb) from public, anon, authenticated;
revoke all on function set_opening_balance(jsonb) from public, anon, authenticated;

grant execute on function create_client_invoice(jsonb) to authenticated;
grant execute on function record_money_in(jsonb) to authenticated;
grant execute on function create_purchase(jsonb) to authenticated;
grant execute on function record_money_out(jsonb) to authenticated;
grant execute on function create_direct_expense(jsonb) to authenticated;
grant execute on function create_transfer(jsonb) to authenticated;
grant execute on function set_opening_balance(jsonb) to authenticated;
