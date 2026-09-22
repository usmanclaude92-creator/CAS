-- ==============================================================================
-- ATOMIC BALANCE ADJUSTMENT + SERVER-ENFORCED TRANSACTION REVERSAL
-- Mirrors the reversal business rules previously enforced only in client JS
-- (accountingService.reverseTransaction) as a SECURITY DEFINER RPC, so
-- reversal preconditions and balance-restoration side effects cannot be
-- bypassed by a client calling the REST API directly.
-- ==============================================================================

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
  else
    raise exception 'Unknown account type %', p_account_type;
  end if;
end;
$$;

revoke all on function adjust_account_balance(text, uuid, numeric) from public, anon, authenticated;
grant execute on function adjust_account_balance(text, uuid, numeric) to authenticated;

create or replace function reverse_transaction(p_module text, p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perm text;
  v_status text;
  v_amount numeric;
  v_received numeric;
  v_paid numeric;
  v_account_type text;
  v_account_id uuid;
  v_linked_id uuid;
  v_to_type text;
  v_to_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Reversal reason is required.';
  end if;

  v_perm := case p_module
    when 'invoices' then 'invoices.reverse'
    when 'purchases' then 'purchases.reverse'
    when 'money_in' then 'money_in.reverse'
    when 'money_out' then 'money_out.reverse'
    when 'expenses' then 'expenses.reverse'
    when 'transfers' then 'transfers.approve'
    else null
  end;
  if v_perm is null then
    raise exception 'Unknown module %', p_module;
  end if;
  if not has_permission(v_perm) then
    raise exception 'Permission denied: %', v_perm;
  end if;

  if p_module = 'invoices' then
    select status, received_amount into v_status, v_received from client_invoices where id = p_id;
    if v_status is null then raise exception 'Invoice not found'; end if;
    if v_status = 'reversed' then raise exception 'Invoice already reversed'; end if;
    if v_received > 0 then raise exception 'Cannot reverse invoice with client receipts applied. Reverse receipts first.'; end if;
    update client_invoices set status = 'reversed' where id = p_id;

  elsif p_module = 'purchases' then
    select status, paid_amount into v_status, v_paid from purchases where id = p_id;
    if v_status is null then raise exception 'Purchase not found'; end if;
    if v_status = 'reversed' then raise exception 'Purchase already reversed'; end if;
    if v_paid > 0 then raise exception 'Cannot reverse purchase with payments applied. Reverse payments first.'; end if;
    update purchases set status = 'reversed' where id = p_id;

  elsif p_module = 'money_in' then
    select status, amount, received_into, account_id, invoice_id
      into v_status, v_amount, v_account_type, v_account_id, v_linked_id
      from money_in where id = p_id;
    if v_status is null then raise exception 'Money In record not found'; end if;
    if v_status = 'reversed' then raise exception 'Transaction already reversed'; end if;
    perform adjust_account_balance(v_account_type, v_account_id, -v_amount);
    if v_linked_id is not null then
      update client_invoices set
        received_amount = greatest(0, received_amount - v_amount),
        outstanding_amount = amount - greatest(0, received_amount - v_amount)
      where id = v_linked_id;
    end if;
    update money_in set status = 'reversed' where id = p_id;

  elsif p_module = 'money_out' then
    select status, amount, paid_from, account_id, purchase_id
      into v_status, v_amount, v_account_type, v_account_id, v_linked_id
      from money_out where id = p_id;
    if v_status is null then raise exception 'Money Out record not found'; end if;
    if v_status = 'reversed' then raise exception 'Transaction already reversed'; end if;
    perform adjust_account_balance(v_account_type, v_account_id, v_amount);
    if v_linked_id is not null then
      update purchases set
        paid_amount = greatest(0, paid_amount - v_amount),
        outstanding_amount = amount - greatest(0, paid_amount - v_amount)
      where id = v_linked_id;
    end if;
    update money_out set status = 'reversed' where id = p_id;

  elsif p_module = 'expenses' then
    select status, amount, paid_from, account_id into v_status, v_amount, v_account_type, v_account_id
      from direct_expenses where id = p_id;
    if v_status is null then raise exception 'Expense not found'; end if;
    if v_status = 'reversed' then raise exception 'Expense already reversed'; end if;
    perform adjust_account_balance(v_account_type, v_account_id, v_amount);
    update direct_expenses set status = 'reversed' where id = p_id;

  elsif p_module = 'transfers' then
    select status, amount, transfer_from_type, transfer_from_id, transfer_to_type, transfer_to_id
      into v_status, v_amount, v_account_type, v_account_id, v_to_type, v_to_id
      from transfers where id = p_id;
    if v_status is null then raise exception 'Transfer not found'; end if;
    if v_status = 'reversed' then raise exception 'Transfer already reversed'; end if;
    perform adjust_account_balance(v_account_type, v_account_id, v_amount);
    perform adjust_account_balance(v_to_type, v_to_id, -v_amount);
    update transfers set status = 'reversed' where id = p_id;
  end if;

  update journal_entries set status = 'reversed' where source_id = p_id;

  insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, reason, details)
  values (
    auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'unknown'),
    coalesce(current_role_code(), 'unknown'),
    'REVERSE',
    p_module,
    p_id,
    p_reason,
    format('Reversed %s transaction %s. Reason: %s', p_module, p_id, p_reason)
  );
end;
$$;

revoke all on function reverse_transaction(text, uuid, text) from public, anon, authenticated;
grant execute on function reverse_transaction(text, uuid, text) to authenticated;
