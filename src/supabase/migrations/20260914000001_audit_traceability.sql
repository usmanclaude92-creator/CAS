-- ==============================================================================
-- MIGRATION: 20260914000001_audit_traceability.sql
-- DESCRIPTION:
-- 1. Verifies that all monetary fields use NUMERIC(18, 3) for OMR currency precision.
-- 2. Adds foreign key constraints linking journal_entries to projects, customers,
--    and vendors with ON DELETE RESTRICT for immutable audit traceability.
-- 3. Adds audit traceability constraint and indexing.
-- ==============================================================================

-- STEP 1: Ensure all monetary columns are strictly NUMERIC(18, 3)
ALTER TABLE IF EXISTS customers 
  ALTER COLUMN opening_balance TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS vendors 
  ALTER COLUMN opening_balance TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS projects 
  ALTER COLUMN contract_value TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS bank_accounts 
  ALTER COLUMN opening_balance TYPE NUMERIC(18, 3),
  ALTER COLUMN current_balance TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS cash_accounts 
  ALTER COLUMN opening_balance TYPE NUMERIC(18, 3),
  ALTER COLUMN current_balance TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS petty_cash_accounts 
  ALTER COLUMN opening_balance TYPE NUMERIC(18, 3),
  ALTER COLUMN current_balance TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS client_invoices 
  ALTER COLUMN amount TYPE NUMERIC(18, 3),
  ALTER COLUMN received_amount TYPE NUMERIC(18, 3),
  ALTER COLUMN outstanding_amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS purchases 
  ALTER COLUMN amount TYPE NUMERIC(18, 3),
  ALTER COLUMN paid_amount TYPE NUMERIC(18, 3),
  ALTER COLUMN outstanding_amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS money_in 
  ALTER COLUMN amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS money_out 
  ALTER COLUMN amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS direct_expenses 
  ALTER COLUMN amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS transfers 
  ALTER COLUMN amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS opening_balances 
  ALTER COLUMN amount TYPE NUMERIC(18, 3);

ALTER TABLE IF EXISTS journal_entries 
  ALTER COLUMN amount TYPE NUMERIC(18, 3);


-- STEP 2: Add linkage columns to journal_entries for audit traceability
ALTER TABLE IF EXISTS journal_entries
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS vendor_id UUID,
  ADD COLUMN IF NOT EXISTS debit_amount NUMERIC(18, 3) NOT NULL DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(18, 3) NOT NULL DEFAULT 0.000;


-- STEP 3: Add Foreign Key Constraints on journal_entries (ON DELETE RESTRICT preserves financial audit history)
DO $$
BEGIN
  -- Foreign key to projects
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_journal_entries_project' AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT fk_journal_entries_project 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;
  END IF;

  -- Foreign key to customers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_journal_entries_customer' AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT fk_journal_entries_customer 
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
  END IF;

  -- Foreign key to vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_journal_entries_vendor' AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT fk_journal_entries_vendor 
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;
  END IF;

  -- Audit Traceability Constraint: Operational entries must link to at least one entity
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_journal_entry_audit_traceability' AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT chk_journal_entry_audit_traceability
      CHECK (
        source_type IN ('transfer', 'opening') OR
        (project_id IS NOT NULL OR customer_id IS NOT NULL OR vendor_id IS NOT NULL)
      );
  END IF;

  -- Strengthen money_in foreign key constraints for audit immutability
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'money_in_customer_id_fkey' AND table_name = 'money_in'
  ) THEN
    ALTER TABLE money_in DROP CONSTRAINT money_in_customer_id_fkey;
    ALTER TABLE money_in ADD CONSTRAINT money_in_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'money_in_invoice_id_fkey' AND table_name = 'money_in'
  ) THEN
    ALTER TABLE money_in DROP CONSTRAINT money_in_invoice_id_fkey;
    ALTER TABLE money_in ADD CONSTRAINT money_in_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES client_invoices(id) ON DELETE RESTRICT;
  END IF;

  -- Strengthen money_out foreign key constraints for audit immutability
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'money_out_vendor_id_fkey' AND table_name = 'money_out'
  ) THEN
    ALTER TABLE money_out DROP CONSTRAINT money_out_vendor_id_fkey;
    ALTER TABLE money_out ADD CONSTRAINT money_out_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'money_out_purchase_id_fkey' AND table_name = 'money_out'
  ) THEN
    ALTER TABLE money_out DROP CONSTRAINT money_out_purchase_id_fkey;
    ALTER TABLE money_out ADD CONSTRAINT money_out_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT;
  END IF;
END $$;


-- STEP 4: Add indexes for audit queries and reporting
CREATE INDEX IF NOT EXISTS idx_journal_entries_project_id ON journal_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_customer_id ON journal_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_vendor_id ON journal_entries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

-- Foreign Key & Audit Trail Indexes
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_customer_id ON client_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_project_id ON client_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_date ON client_invoices(date);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id ON purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchases_project_id ON purchases(project_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_money_in_customer_id ON money_in(customer_id);
CREATE INDEX IF NOT EXISTS idx_money_in_project_id ON money_in(project_id);
CREATE INDEX IF NOT EXISTS idx_money_in_invoice_id ON money_in(invoice_id);
CREATE INDEX IF NOT EXISTS idx_money_out_vendor_id ON money_out(vendor_id);
CREATE INDEX IF NOT EXISTS idx_money_out_project_id ON money_out(project_id);
CREATE INDEX IF NOT EXISTS idx_money_out_purchase_id ON money_out(purchase_id);
CREATE INDEX IF NOT EXISTS idx_money_out_expense_head_id ON money_out(expense_head_id);
CREATE INDEX IF NOT EXISTS idx_direct_expenses_project_id ON direct_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_direct_expenses_expense_head_id ON direct_expenses(expense_head_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_transaction_id ON audit_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_attachments_related_transaction_id ON attachments(related_transaction_id);
