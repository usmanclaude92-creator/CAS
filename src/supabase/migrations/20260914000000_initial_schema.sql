-- ==============================================================================
-- CONSTRUCTION ACCOUNTING & FINANCIAL REPORTING SYSTEM
-- Production-Ready Supabase PostgreSQL Schema
-- Currency: OMR (3 decimal places: NUMERIC(18, 3))
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'accountant', 'manager', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS MASTER
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  opening_balance NUMERIC(18, 3) DEFAULT 0.000,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VENDORS MASTER
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  opening_balance NUMERIC(18, 3) DEFAULT 0.000,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROJECTS MASTER
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  contract_value NUMERIC(18, 3) NOT NULL DEFAULT 0.000 CHECK (contract_value >= 0),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'OMR',
  opening_balance NUMERIC(18, 3) DEFAULT 0.000,
  current_balance NUMERIC(18, 3) DEFAULT 0.000,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CASH ACCOUNTS
CREATE TABLE IF NOT EXISTS cash_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name VARCHAR(255) NOT NULL,
  opening_balance NUMERIC(18, 3) DEFAULT 0.000,
  current_balance NUMERIC(18, 3) DEFAULT 0.000,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PETTY CASH ACCOUNTS
CREATE TABLE IF NOT EXISTS petty_cash_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name VARCHAR(255) NOT NULL,
  opening_balance NUMERIC(18, 3) DEFAULT 0.000,
  current_balance NUMERIC(18, 3) DEFAULT 0.000,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. EXPENSE HEADS
CREATE TABLE IF NOT EXISTS expense_heads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CLIENT INVOICES / IPCS
CREATE TABLE IF NOT EXISTS client_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('IPC', 'Invoice')),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  date DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  description TEXT,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  document_ref VARCHAR(100) NOT NULL,
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  received_amount NUMERIC(18, 3) DEFAULT 0.000 CHECK (received_amount >= 0),
  outstanding_amount NUMERIC(18, 3) NOT NULL CHECK (outstanding_amount >= 0),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_invoice_number VARCHAR(100) UNIQUE NOT NULL,
  date DATE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  purchase_category VARCHAR(100),
  description TEXT,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  document_ref VARCHAR(100) NOT NULL,
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  paid_amount NUMERIC(18, 3) DEFAULT 0.000 CHECK (paid_amount >= 0),
  outstanding_amount NUMERIC(18, 3) NOT NULL CHECK (outstanding_amount >= 0),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MONEY IN (Receipts)
CREATE TABLE IF NOT EXISTS money_in (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  received_from VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  against VARCHAR(20) NOT NULL CHECK (against IN ('invoice', 'other')),
  invoice_id UUID REFERENCES client_invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  received_into VARCHAR(20) NOT NULL CHECK (received_into IN ('bank', 'cash', 'petty_cash')),
  account_id UUID NOT NULL,
  document_ref VARCHAR(100),
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. MONEY OUT (Payments)
CREATE TABLE IF NOT EXISTS money_out (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  paid_to VARCHAR(255) NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT,
  payment_for VARCHAR(20) NOT NULL CHECK (payment_for IN ('purchase', 'expense', 'other')),
  purchase_id UUID REFERENCES purchases(id) ON DELETE RESTRICT,
  expense_head_id UUID REFERENCES expense_heads(id) ON DELETE RESTRICT,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  paid_from VARCHAR(20) NOT NULL CHECK (paid_from IN ('bank', 'cash', 'petty_cash')),
  account_id UUID NOT NULL,
  document_ref VARCHAR(100),
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. DIRECT EXPENSES
CREATE TABLE IF NOT EXISTS direct_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_date DATE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  expense_head_id UUID NOT NULL REFERENCES expense_heads(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  paid_from VARCHAR(20) NOT NULL CHECK (paid_from IN ('bank', 'cash', 'petty_cash')),
  account_id UUID NOT NULL,
  document_ref VARCHAR(100),
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. TRANSFERS
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  transfer_from_type VARCHAR(20) NOT NULL CHECK (transfer_from_type IN ('bank', 'cash', 'petty_cash')),
  transfer_from_id UUID NOT NULL,
  transfer_to_type VARCHAR(20) NOT NULL CHECK (transfer_to_type IN ('bank', 'cash', 'petty_cash')),
  transfer_to_id UUID NOT NULL,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  document_ref VARCHAR(100) NOT NULL,
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. OPENING BALANCES
CREATE TABLE IF NOT EXISTS opening_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'cash', 'petty_cash', 'customer', 'vendor', 'other')),
  account_id UUID NOT NULL,
  opening_date DATE NOT NULL,
  amount NUMERIC(18, 3) NOT NULL,
  document_ref VARCHAR(100),
  attachment_url TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. JOURNAL ENTRIES (DOUBLE-ENTRY ENGINE)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number VARCHAR(100) UNIQUE NOT NULL,
  date DATE NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  project_id UUID,
  customer_id UUID,
  vendor_id UUID,
  description TEXT NOT NULL,
  debit_account VARCHAR(100) NOT NULL,
  credit_account VARCHAR(100) NOT NULL,
  amount NUMERIC(18, 3) NOT NULL CHECK (amount > 0),
  debit_amount NUMERIC(18, 3) NOT NULL DEFAULT 0.000 CHECK (debit_amount >= 0),
  credit_amount NUMERIC(18, 3) NOT NULL DEFAULT 0.000 CHECK (credit_amount >= 0),
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_journal_entries_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_journal_entries_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_journal_entries_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT chk_journal_entry_audit_traceability CHECK (
    source_type IN ('transfer', 'opening') OR
    (project_id IS NOT NULL OR customer_id IS NOT NULL OR vendor_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_project_id ON journal_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_customer_id ON journal_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_vendor_id ON journal_entries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

-- Foreign Key & Audit Traceability Indexes
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

-- 17. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NOT NULL,
  transaction_id UUID,
  document_ref VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  details TEXT NOT NULL,
  ip_address VARCHAR(50)
);

-- 18. ATTACHMENTS
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  related_transaction_id UUID,
  related_transaction_type VARCHAR(100),
  public_url TEXT
);

-- 19. STORAGE BUCKET CONFIGURATION
INSERT INTO storage.buckets (id, name, public)
VALUES ('construction_attachments', 'construction_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 20. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform operations based on company role
CREATE POLICY "Allow read access for authenticated users" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow write access for admin and accountant" ON projects FOR ALL USING (true);

CREATE POLICY "Allow read access customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow write access customers" ON customers FOR ALL USING (true);

CREATE POLICY "Allow read access vendors" ON vendors FOR SELECT USING (true);
CREATE POLICY "Allow write access vendors" ON vendors FOR ALL USING (true);

CREATE POLICY "Allow read access bank_accounts" ON bank_accounts FOR SELECT USING (true);
CREATE POLICY "Allow write access bank_accounts" ON bank_accounts FOR ALL USING (true);

CREATE POLICY "Allow read access cash_accounts" ON cash_accounts FOR SELECT USING (true);
CREATE POLICY "Allow write access cash_accounts" ON cash_accounts FOR ALL USING (true);

CREATE POLICY "Allow read access petty_cash_accounts" ON petty_cash_accounts FOR SELECT USING (true);
CREATE POLICY "Allow write access petty_cash_accounts" ON petty_cash_accounts FOR ALL USING (true);

CREATE POLICY "Allow read access client_invoices" ON client_invoices FOR SELECT USING (true);
CREATE POLICY "Allow write access client_invoices" ON client_invoices FOR ALL USING (true);

CREATE POLICY "Allow read access purchases" ON purchases FOR SELECT USING (true);
CREATE POLICY "Allow write access purchases" ON purchases FOR ALL USING (true);

CREATE POLICY "Allow read access money_in" ON money_in FOR SELECT USING (true);
CREATE POLICY "Allow write access money_in" ON money_in FOR ALL USING (true);

CREATE POLICY "Allow read access money_out" ON money_out FOR SELECT USING (true);
CREATE POLICY "Allow write access money_out" ON money_out FOR ALL USING (true);

CREATE POLICY "Allow read access direct_expenses" ON direct_expenses FOR SELECT USING (true);
CREATE POLICY "Allow write access direct_expenses" ON direct_expenses FOR ALL USING (true);

CREATE POLICY "Allow read access transfers" ON transfers FOR SELECT USING (true);
CREATE POLICY "Allow write access transfers" ON transfers FOR ALL USING (true);

CREATE POLICY "Allow read access audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);
