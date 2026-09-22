-- ==============================================================================
-- SEED: roles, permissions, workflow settings, approval limits
-- Mirrors src/services/permissionsData.ts DEFAULT_ROLES / DEFAULT_WORKFLOW_SETTINGS
-- so the server-side roles table (used by RLS) matches the client's role model.
-- ==============================================================================

insert into roles (code, name, description, is_system, permissions) values
('super_admin', 'Super Administrator',
 'Full unrestricted system access, security administration, user management, and exclusive master-data import authority.',
 true,
 array[
  'dashboard.view',
  'projects.view','projects.create','projects.edit','projects.archive','projects.export',
  'customers.view','customers.create','customers.edit','customers.export',
  'vendors.view','vendors.create','vendors.edit','vendors.export',
  'invoices.view','invoices.create','invoices.edit','invoices.submit','invoices.approve','invoices.post','invoices.cancel','invoices.reverse','invoices.export',
  'purchases.view','purchases.create','purchases.edit','purchases.submit','purchases.approve','purchases.post','purchases.cancel','purchases.reverse','purchases.export',
  'money_in.view','money_in.create','money_in.edit','money_in.submit','money_in.approve','money_in.post','money_in.reverse','money_in.export',
  'money_out.view','money_out.create','money_out.edit','money_out.submit','money_out.approve','money_out.post','money_out.reverse','money_out.export',
  'expenses.view','expenses.create','expenses.edit','expenses.submit','expenses.approve','expenses.post','expenses.reverse','expenses.export',
  'treasury.view','bank_accounts.view','bank_accounts.create','bank_accounts.edit','cash.view','petty_cash.view','transfers.create','transfers.approve',
  'reports.view','reports.export',
  'documents.view','documents.upload','documents.download','documents.delete',
  'approvals.view','approvals.approve','approvals.reject',
  'users.view','users.create','users.edit','users.activate','users.deactivate',
  'roles.view','roles.create','roles.edit','roles.delete',
  'settings.view','settings.edit',
  'audit.view','audit.export',
  'master_data.import'
 ]),
('accounts_manager', 'Accounts Manager',
 'Manages day-to-day accounting operations, approvals, and financial reporting. Cannot manage Super Admin security or import master data.',
 true,
 array[
  'dashboard.view',
  'projects.view','projects.create','projects.edit','projects.archive','projects.export',
  'customers.view','customers.create','customers.edit','customers.export',
  'vendors.view','vendors.create','vendors.edit','vendors.export',
  'invoices.view','invoices.create','invoices.edit','invoices.submit','invoices.approve','invoices.post','invoices.cancel','invoices.reverse','invoices.export',
  'purchases.view','purchases.create','purchases.edit','purchases.submit','purchases.approve','purchases.post','purchases.cancel','purchases.reverse','purchases.export',
  'money_in.view','money_in.create','money_in.edit','money_in.submit','money_in.approve','money_in.post','money_in.reverse','money_in.export',
  'money_out.view','money_out.create','money_out.edit','money_out.submit','money_out.approve','money_out.post','money_out.reverse','money_out.export',
  'expenses.view','expenses.create','expenses.edit','expenses.submit','expenses.approve','expenses.post','expenses.reverse','expenses.export',
  'treasury.view','bank_accounts.view','bank_accounts.create','bank_accounts.edit','cash.view','petty_cash.view','transfers.create','transfers.approve',
  'reports.view','reports.export',
  'documents.view','documents.upload','documents.download','documents.delete',
  'approvals.view','approvals.approve','approvals.reject',
  'users.view','users.create','users.edit',
  'roles.view',
  'settings.view','settings.edit',
  'audit.view','audit.export'
 ]),
('finance_manager', 'Finance Manager',
 'Responsible for accounting operations, financial review, approvals, financial reports, receivables, payables, and treasury.',
 true,
 array[
  'dashboard.view','projects.view','projects.export',
  'customers.view','customers.create','customers.edit','customers.export',
  'vendors.view','vendors.create','vendors.edit','vendors.export',
  'invoices.view','invoices.create','invoices.edit','invoices.submit','invoices.approve','invoices.post','invoices.reverse','invoices.export',
  'purchases.view','purchases.create','purchases.edit','purchases.submit','purchases.approve','purchases.post','purchases.reverse','purchases.export',
  'money_in.view','money_in.create','money_in.edit','money_in.submit','money_in.approve','money_in.post','money_in.reverse','money_in.export',
  'money_out.view','money_out.create','money_out.edit','money_out.submit','money_out.approve','money_out.post','money_out.reverse','money_out.export',
  'expenses.view','expenses.create','expenses.edit','expenses.submit','expenses.approve','expenses.post','expenses.reverse','expenses.export',
  'treasury.view','bank_accounts.view','cash.view','petty_cash.view','transfers.create','transfers.approve',
  'reports.view','reports.export',
  'documents.view','documents.upload','documents.download',
  'approvals.view','approvals.approve','approvals.reject',
  'audit.view','audit.export',
  'settings.view'
 ]),
('accountant', 'Accountant',
 'Daily accounting entries, invoices, purchases, expenses, receipts, payments, transfers, and general ledger maintenance.',
 true,
 array[
  'dashboard.view','projects.view',
  'customers.view','customers.create','customers.edit',
  'vendors.view','vendors.create','vendors.edit',
  'invoices.view','invoices.create','invoices.edit','invoices.submit','invoices.export',
  'purchases.view','purchases.create','purchases.edit','purchases.submit','purchases.export',
  'money_in.view','money_in.create','money_in.edit','money_in.submit','money_in.export',
  'money_out.view','money_out.create','money_out.edit','money_out.submit','money_out.export',
  'expenses.view','expenses.create','expenses.edit','expenses.submit','expenses.export',
  'treasury.view','bank_accounts.view','cash.view','petty_cash.view','transfers.create',
  'reports.view','reports.export',
  'documents.view','documents.upload','documents.download',
  'approvals.view',
  'settings.view'
 ]),
('ar_user', 'Accounts Receivable User',
 'Responsible for customers, client invoices/IPC, receipts (Money In), customer ledgers, and payment history.',
 true,
 array[
  'dashboard.view',
  'customers.view','customers.create','customers.edit','customers.export',
  'invoices.view','invoices.create','invoices.edit','invoices.submit','invoices.export',
  'money_in.view','money_in.create','money_in.edit','money_in.submit','money_in.export',
  'reports.view',
  'documents.view','documents.upload','documents.download'
 ]),
('ap_user', 'Accounts Payable User',
 'Responsible for vendors, purchases, vendor payments (Money Out), vendor ledgers, and payable aging.',
 true,
 array[
  'dashboard.view',
  'vendors.view','vendors.create','vendors.edit','vendors.export',
  'purchases.view','purchases.create','purchases.edit','purchases.submit','purchases.export',
  'money_out.view','money_out.create','money_out.edit','money_out.submit','money_out.export',
  'reports.view',
  'documents.view','documents.upload','documents.download'
 ]),
('treasury_user', 'Treasury / Cashier User',
 'Manages commercial bank accounts, cash in hand, petty cash, receipts, payments, and inter-account transfers.',
 true,
 array[
  'dashboard.view',
  'treasury.view','bank_accounts.view','cash.view','petty_cash.view',
  'money_in.view','money_in.create',
  'money_out.view','money_out.create',
  'transfers.create',
  'reports.view',
  'documents.view','documents.upload','documents.download'
 ]),
('project_accountant', 'Project Accountant',
 'Manages invoices, purchases, direct expenses, and financial tracking for explicitly assigned projects only.',
 true,
 array[
  'dashboard.view','projects.view',
  'invoices.view','invoices.create','invoices.edit','invoices.submit',
  'purchases.view','purchases.create','purchases.edit','purchases.submit',
  'expenses.view','expenses.create','expenses.edit','expenses.submit',
  'reports.view',
  'documents.view','documents.upload','documents.download'
 ]),
('viewer', 'Viewer',
 'Read-only access across enabled modules. Cannot create, edit, delete, approve, post, reverse, or import.',
 true,
 array[
  'dashboard.view','projects.view','customers.view','vendors.view','invoices.view',
  'purchases.view','money_in.view','money_out.view','expenses.view','treasury.view',
  'reports.view','documents.view'
 ])
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  updated_at = now();

insert into workflow_settings (id, separation_of_duties_enabled, require_approval_above_omr)
values (true, true, 0.000)
on conflict (id) do nothing;

insert into approval_limits (role_code, max_amount_omr) values
('accountant', 1000.000),
('finance_manager', 10000.000),
('accounts_manager', 50000.000),
('super_admin', 999999999.000),
('project_accountant', 500.000),
('ar_user', 1000.000),
('ap_user', 1000.000),
('treasury_user', 2000.000),
('viewer', 0.000)
on conflict (role_code) do update set max_amount_omr = excluded.max_amount_omr;
