-- ==============================================================================
-- VAT PHASE 2: sequential tax-invoice numbering + Credit/Debit Note documents
--
-- Oman VAT (Executive Regulations, Royal Decree 121/2020) requires a tax
-- invoice to carry a sequential number that uniquely identifies the
-- document, issued in order with no gaps. invoice_number on client_invoices
-- was previously free text typed by the user — this migration makes it
-- server-generated and atomic instead.
--
-- Also adds a Credit/Debit Note document type covering both directions:
-- customer-side (adjusting a posted Client Invoice, affecting Output VAT)
-- and vendor-side (adjusting a posted Purchase, affecting Input VAT). Each
-- note is sequentially numbered the same way, references the original
-- document, and amends its net/vat/gross totals and outstanding balance —
-- never rewriting the original document's own transaction history.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Sequential numbering
-- ------------------------------------------------------------------------------

create table if not exists document_sequences (
  series text primary key,
  last_number bigint not null default 0,
  updated_at timestamptz default now()
);

alter table document_sequences enable row level security;
-- No policies: this table is only ever touched internally by next_document_number(),
-- which runs as a SECURITY DEFINER function and so bypasses RLS. Nothing reads or
-- writes it directly via PostgREST.

create or replace function next_document_number(p_series text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_key text := p_series || '_' || v_year;
  v_num bigint;
begin
  insert into document_sequences (series, last_number)
  values (v_key, 1)
  on conflict (series) do update set last_number = document_sequences.last_number + 1, updated_at = now()
  returning last_number into v_num;

  return p_prefix || '-' || v_year || '-' || lpad(v_num::text, 5, '0');
end;
$$;

revoke all on function next_document_number(text, text) from public, anon, authenticated;
-- Deliberately not granted to authenticated: it's only called from inside other
-- SECURITY DEFINER functions (which run with the function owner's privileges), so
-- client code can never reserve/burn a sequence number without actually posting
-- a document, and can never preview or guess the next number either.

-- create_client_invoice now generates invoice_number itself instead of trusting
-- the payload, so it's always sequential regardless of what the client sends.
create or replace function create_client_invoice(payload jsonb)
returns client_invoices
language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := (payload->>'projectId')::uuid;
  v_vat_amount numeric := coalesce((payload->>'vatAmount')::numeric, 0);
  v_invoice_type text := coalesce(payload->>'invoiceType', 'Invoice');
  v_invoice_number text;
  v_row client_invoices;
begin
  if not has_permission('invoices.create') then raise exception 'Permission denied: invoices.create'; end if;
  if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

  v_invoice_number := next_document_number(
    case when v_invoice_type = 'IPC' then 'ipc' else 'invoice' end,
    case when v_invoice_type = 'IPC' then 'IPC' else 'INV' end
  );

  insert into client_invoices (
    invoice_type, invoice_number, date, customer_id, project_id, description, amount,
    net_amount, vat_rate, vat_amount, vat_treatment,
    document_ref, attachment_url, attachment_name, received_amount, outstanding_amount,
    status, remarks, created_by, created_by_name
  ) values (
    v_invoice_type, v_invoice_number, (payload->>'date')::date,
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

-- purchase_invoice_number keeps working as-is (vendor bills carry the vendor's
-- own numbering, which this system isn't the system of record for) — only
-- client_invoices.invoice_number, which Artify itself issues to customers, is
-- brought under sequential control here.

-- ------------------------------------------------------------------------------
-- Credit / Debit Notes
-- ------------------------------------------------------------------------------

create table if not exists credit_debit_notes (
  id uuid primary key default uuid_generate_v4(),
  note_type varchar(10) not null check (note_type in ('credit','debit')),
  note_number varchar(100) unique not null,
  date date not null,
  party_type varchar(10) not null check (party_type in ('customer','vendor')),
  source_type varchar(20) not null check (source_type in ('client_invoice','purchase')),
  source_id uuid not null,
  source_document_number varchar(100) not null,
  customer_id uuid references customers(id) on delete restrict,
  vendor_id uuid references vendors(id) on delete restrict,
  project_id uuid not null references projects(id) on delete restrict,
  reason text not null,
  net_amount numeric(18,3) not null check (net_amount > 0),
  vat_rate numeric(5,2) not null default 0,
  vat_amount numeric(18,3) not null default 0,
  gross_amount numeric(18,3) not null,
  vat_treatment varchar(20) not null default 'out_of_scope'
    check (vat_treatment in ('standard','zero_rated','exempt','out_of_scope','reverse_charge')),
  document_ref varchar(100) not null,
  attachment_url text,
  attachment_name varchar(255),
  status varchar(20) default 'posted' check (status in ('posted','reversed')),
  remarks text,
  created_by uuid references profiles(id),
  created_by_name varchar(255),
  created_at timestamptz default now(),
  constraint chk_credit_debit_note_party check (
    (party_type = 'customer' and source_type = 'client_invoice' and customer_id is not null and vendor_id is null) or
    (party_type = 'vendor' and source_type = 'purchase' and vendor_id is not null and customer_id is null)
  )
);

create index if not exists idx_credit_debit_notes_source on credit_debit_notes(source_type, source_id);
create index if not exists idx_credit_debit_notes_project_id on credit_debit_notes(project_id);
create index if not exists idx_credit_debit_notes_customer_id on credit_debit_notes(customer_id);
create index if not exists idx_credit_debit_notes_vendor_id on credit_debit_notes(vendor_id);

alter table credit_debit_notes enable row level security;

create policy "credit_debit_notes_select" on credit_debit_notes for select
  using (
    can_access_project(project_id) and (
      (party_type = 'customer' and has_permission('invoices.view')) or
      (party_type = 'vendor' and has_permission('purchases.view'))
    )
  );

create policy "credit_debit_notes_insert" on credit_debit_notes for insert
  with check (
    created_by = auth.uid() and can_access_project(project_id) and (
      (party_type = 'customer' and has_permission('invoices.create')) or
      (party_type = 'vendor' and has_permission('purchases.create'))
    )
  );

-- Applies a credit/debit note's effect to the client_invoice or purchase it
-- amends: credit notes reduce the document's net/vat/gross/outstanding by the
-- note's amount, debit notes increase it. Guards against a note that would
-- push outstanding below what's already been received/paid, or below zero.
create or replace function create_credit_debit_note(payload jsonb)
returns credit_debit_notes
language plpgsql security definer set search_path = public as $$
declare
  v_note_type text := payload->>'noteType';
  v_party_type text := payload->>'partyType';
  v_source_type text := payload->>'sourceType';
  v_source_id uuid := (payload->>'sourceId')::uuid;
  v_project_id uuid;
  v_customer_id uuid;
  v_vendor_id uuid;
  v_source_number text;
  v_net numeric := (payload->>'netAmount')::numeric;
  v_vat numeric := coalesce((payload->>'vatAmount')::numeric, 0);
  v_gross numeric := (payload->>'grossAmount')::numeric;
  v_sign numeric := case when v_note_type = 'credit' then -1 else 1 end;
  v_note_number text;
  v_row credit_debit_notes;
  v_new_amount numeric;
  v_new_outstanding numeric;
begin
  if v_note_type not in ('credit','debit') then raise exception 'Invalid note type'; end if;
  if v_party_type not in ('customer','vendor') then raise exception 'Invalid party type'; end if;

  if v_party_type = 'customer' then
    if v_source_type <> 'client_invoice' then raise exception 'Customer notes must reference a client_invoice'; end if;
    if not has_permission('invoices.create') then raise exception 'Permission denied: invoices.create'; end if;

    select project_id, customer_id, invoice_number, amount + v_sign * v_gross, outstanding_amount + v_sign * v_gross
      into v_project_id, v_customer_id, v_source_number, v_new_amount, v_new_outstanding
      from client_invoices where id = v_source_id for update;
    if not found then raise exception 'Source client invoice not found'; end if;
    if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

    if v_new_amount < (select received_amount from client_invoices where id = v_source_id) then
      raise exception 'Cannot reduce invoice below the amount already received';
    end if;
    if v_new_outstanding < 0 then raise exception 'Note amount exceeds invoice outstanding balance'; end if;

    update client_invoices set
      amount = v_new_amount,
      net_amount = net_amount + v_sign * v_net,
      vat_amount = vat_amount + v_sign * v_vat,
      outstanding_amount = v_new_outstanding
      where id = v_source_id;

    v_note_number := next_document_number(case when v_note_type = 'credit' then 'credit_note' else 'debit_note' end,
      case when v_note_type = 'credit' then 'CN' else 'DN' end);

    insert into credit_debit_notes (
      note_type, note_number, date, party_type, source_type, source_id, source_document_number,
      customer_id, project_id, reason, net_amount, vat_rate, vat_amount, gross_amount, vat_treatment,
      document_ref, attachment_url, attachment_name, remarks, created_by, created_by_name
    ) values (
      v_note_type, v_note_number, (payload->>'date')::date, v_party_type, v_source_type, v_source_id, v_source_number,
      v_customer_id, v_project_id, payload->>'reason', v_net, coalesce((payload->>'vatRate')::numeric, 0), v_vat, v_gross,
      coalesce(payload->>'vatTreatment', 'out_of_scope'), payload->>'documentRef', payload->>'attachmentUrl',
      payload->>'attachmentName', payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
    ) returning * into v_row;

    insert into journal_entries (entry_number, date, source_type, source_id, project_id, customer_id, description, debit_account, credit_account, amount)
    values (v_note_number, v_row.date, 'credit_debit_note', v_row.id, v_project_id, v_customer_id,
      coalesce(payload->>'journalDescription', '') || ' - ' || initcap(v_note_type) || ' Note ' || v_note_number,
      case when v_note_type = 'credit' then 'Sales Returns & Allowances' else 'Accounts Receivable' end,
      case when v_note_type = 'credit' then 'Accounts Receivable' else 'Sales Revenue' end,
      v_net);

    if v_vat > 0 then
      insert into journal_entries (entry_number, date, source_type, source_id, project_id, customer_id, description, debit_account, credit_account, amount)
      values (v_note_number || '-VAT', v_row.date, 'credit_debit_note', v_row.id, v_project_id, v_customer_id,
        coalesce(payload->>'journalDescription', '') || ' - ' || initcap(v_note_type) || ' Note VAT',
        case when v_note_type = 'credit' then 'Output VAT Payable' else 'Accounts Receivable' end,
        case when v_note_type = 'credit' then 'Accounts Receivable' else 'Output VAT Payable' end,
        v_vat);
    end if;

    insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
    values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
      'CREATE_CREDIT_DEBIT_NOTE', 'Invoices & IPC', v_row.id, v_row.document_ref, payload->>'auditDetails');

  else
    if v_source_type <> 'purchase' then raise exception 'Vendor notes must reference a purchase'; end if;
    if not has_permission('purchases.create') then raise exception 'Permission denied: purchases.create'; end if;

    select project_id, vendor_id, purchase_invoice_number, amount + v_sign * v_gross, outstanding_amount + v_sign * v_gross
      into v_project_id, v_vendor_id, v_source_number, v_new_amount, v_new_outstanding
      from purchases where id = v_source_id for update;
    if not found then raise exception 'Source purchase not found'; end if;
    if not can_access_project(v_project_id) then raise exception 'Unauthorized: no access to this project'; end if;

    if v_new_amount < (select paid_amount from purchases where id = v_source_id) then
      raise exception 'Cannot reduce purchase below the amount already paid';
    end if;
    if v_new_outstanding < 0 then raise exception 'Note amount exceeds purchase outstanding balance'; end if;

    update purchases set
      amount = v_new_amount,
      net_amount = net_amount + v_sign * v_net,
      vat_amount = vat_amount + v_sign * v_vat,
      outstanding_amount = v_new_outstanding
      where id = v_source_id;

    v_note_number := next_document_number(case when v_note_type = 'credit' then 'vendor_credit_note' else 'vendor_debit_note' end,
      case when v_note_type = 'credit' then 'VCN' else 'VDN' end);

    insert into credit_debit_notes (
      note_type, note_number, date, party_type, source_type, source_id, source_document_number,
      vendor_id, project_id, reason, net_amount, vat_rate, vat_amount, gross_amount, vat_treatment,
      document_ref, attachment_url, attachment_name, remarks, created_by, created_by_name
    ) values (
      v_note_type, v_note_number, (payload->>'date')::date, v_party_type, v_source_type, v_source_id, v_source_number,
      v_vendor_id, v_project_id, payload->>'reason', v_net, coalesce((payload->>'vatRate')::numeric, 0), v_vat, v_gross,
      coalesce(payload->>'vatTreatment', 'out_of_scope'), payload->>'documentRef', payload->>'attachmentUrl',
      payload->>'attachmentName', payload->>'remarks', auth.uid(), (select full_name from profiles where id = auth.uid())
    ) returning * into v_row;

    insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
    values (v_note_number, v_row.date, 'credit_debit_note', v_row.id, v_project_id, v_vendor_id,
      coalesce(payload->>'journalDescription', '') || ' - ' || initcap(v_note_type) || ' Note ' || v_note_number,
      case when v_note_type = 'credit' then 'Accounts Payable' else 'Purchases / Cost of Work' end,
      case when v_note_type = 'credit' then 'Purchases / Cost of Work' else 'Accounts Payable' end,
      v_net);

    if v_vat > 0 then
      insert into journal_entries (entry_number, date, source_type, source_id, project_id, vendor_id, description, debit_account, credit_account, amount)
      values (v_note_number || '-VAT', v_row.date, 'credit_debit_note', v_row.id, v_project_id, v_vendor_id,
        coalesce(payload->>'journalDescription', '') || ' - ' || initcap(v_note_type) || ' Note VAT',
        case when v_note_type = 'credit' then 'Accounts Payable' else 'Input VAT Receivable' end,
        case when v_note_type = 'credit' then 'Input VAT Receivable' else 'Accounts Payable' end,
        v_vat);
    end if;

    insert into audit_logs (user_id, user_name, user_role, action, module, transaction_id, document_ref, details)
    values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'unknown'), coalesce(current_role_code(), 'unknown'),
      'CREATE_CREDIT_DEBIT_NOTE', 'Purchases & Payables', v_row.id, v_row.document_ref, payload->>'auditDetails');
  end if;

  return v_row;
end;
$$;

revoke all on function create_credit_debit_note(jsonb) from public, anon, authenticated;
grant execute on function create_credit_debit_note(jsonb) to authenticated;
