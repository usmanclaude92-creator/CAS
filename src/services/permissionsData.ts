import { Permission, Role, WorkflowSettings } from '../types/auth';

export const ALL_PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'p1', code: 'dashboard.view', module: 'Dashboard', name: 'View Dashboard', description: 'Access executive financial overview and metrics' },

  // Projects
  { id: 'p2', code: 'projects.view', module: 'Projects', name: 'View Projects', description: 'View project listings and financial summaries' },
  { id: 'p3', code: 'projects.create', module: 'Projects', name: 'Create Projects', description: 'Create new construction projects' },
  { id: 'p4', code: 'projects.edit', module: 'Projects', name: 'Edit Projects', description: 'Modify project details, budgets and status' },
  { id: 'p5', code: 'projects.archive', module: 'Projects', name: 'Archive Projects', description: 'Mark projects as completed or archived' },
  { id: 'p6', code: 'projects.export', module: 'Projects', name: 'Export Projects', description: 'Export project data to Excel/CSV' },

  // Customers
  { id: 'p7', code: 'customers.view', module: 'Customers', name: 'View Customers', description: 'View client directory and receivables' },
  { id: 'p8', code: 'customers.create', module: 'Customers', name: 'Create Customers', description: 'Add new client records' },
  { id: 'p9', code: 'customers.edit', module: 'Customers', name: 'Edit Customers', description: 'Update customer contact and balance info' },
  { id: 'p10', code: 'customers.export', module: 'Customers', name: 'Export Customers', description: 'Export customer ledgers' },

  // Vendors
  { id: 'p11', code: 'vendors.view', module: 'Vendors', name: 'View Vendors', description: 'View supplier and subcontractor directory' },
  { id: 'p12', code: 'vendors.create', module: 'Vendors', name: 'Create Vendors', description: 'Add new vendors and suppliers' },
  { id: 'p13', code: 'vendors.edit', module: 'Vendors', name: 'Edit Vendors', description: 'Update vendor details and terms' },
  { id: 'p14', code: 'vendors.export', module: 'Vendors', name: 'Export Vendors', description: 'Export vendor ledgers' },

  // Client Invoices / IPC
  { id: 'p15', code: 'invoices.view', module: 'Client Invoices', name: 'View Invoices', description: 'View client invoices and IPC certificates' },
  { id: 'p16', code: 'invoices.create', module: 'Client Invoices', name: 'Create Invoices', description: 'Create draft client invoices/IPCs' },
  { id: 'p17', code: 'invoices.edit', module: 'Client Invoices', name: 'Edit Invoices', description: 'Edit draft invoices before submission' },
  { id: 'p18', code: 'invoices.submit', module: 'Client Invoices', name: 'Submit Invoices', description: 'Submit invoice for managerial approval' },
  { id: 'p19', code: 'invoices.approve', module: 'Client Invoices', name: 'Approve Invoices', description: 'Approve submitted client invoices' },
  { id: 'p20', code: 'invoices.post', module: 'Client Invoices', name: 'Post Invoices', description: 'Post invoice to general ledger' },
  { id: 'p21', code: 'invoices.cancel', module: 'Client Invoices', name: 'Cancel Invoices', description: 'Cancel draft invoices' },
  { id: 'p22', code: 'invoices.reverse', module: 'Client Invoices', name: 'Reverse Invoices', description: 'Execute accounting reversal for posted invoices' },
  { id: 'p23', code: 'invoices.export', module: 'Client Invoices', name: 'Export Invoices', description: 'Export invoices to Excel' },
  {
    id: 'p94',
    code: 'invoices.import',
    module: 'Client Invoices',
    name: 'Import Historical Invoices',
    description: 'Bulk-import historical Client Invoices/IPCs from Excel, preserving each row\'s real historical invoice number instead of assigning a new sequential one (Super Administrator only by default)',
  },

  // Purchases
  { id: 'p24', code: 'purchases.view', module: 'Purchases', name: 'View Purchases', description: 'View vendor bills and purchase records' },
  { id: 'p25', code: 'purchases.create', module: 'Purchases', name: 'Create Purchases', description: 'Record vendor purchase bills' },
  { id: 'p26', code: 'purchases.edit', module: 'Purchases', name: 'Edit Purchases', description: 'Edit purchase records before posting' },
  { id: 'p27', code: 'purchases.submit', module: 'Purchases', name: 'Submit Purchases', description: 'Submit purchase for approval' },
  { id: 'p28', code: 'purchases.approve', module: 'Purchases', name: 'Approve Purchases', description: 'Approve vendor purchases' },
  { id: 'p29', code: 'purchases.post', module: 'Purchases', name: 'Post Purchases', description: 'Post purchase bill to ledger' },
  { id: 'p30', code: 'purchases.cancel', module: 'Purchases', name: 'Cancel Purchases', description: 'Cancel draft purchases' },
  { id: 'p31', code: 'purchases.reverse', module: 'Purchases', name: 'Reverse Purchases', description: 'Reverse posted purchase bills' },
  { id: 'p32', code: 'purchases.export', module: 'Purchases', name: 'Export Purchases', description: 'Export purchase reports' },

  // Money In
  { id: 'p33', code: 'money_in.view', module: 'Money In', name: 'View Receipts', description: 'View client receipts and collections' },
  { id: 'p34', code: 'money_in.create', module: 'Money In', name: 'Create Receipts', description: 'Record inbound money receipt' },
  { id: 'p35', code: 'money_in.edit', module: 'Money In', name: 'Edit Receipts', description: 'Modify receipt before posting' },
  { id: 'p36', code: 'money_in.submit', module: 'Money In', name: 'Submit Receipts', description: 'Submit receipt for approval' },
  { id: 'p37', code: 'money_in.approve', module: 'Money In', name: 'Approve Receipts', description: 'Approve money receipts' },
  { id: 'p38', code: 'money_in.post', module: 'Money In', name: 'Post Receipts', description: 'Post money receipt to cash/bank' },
  { id: 'p39', code: 'money_in.reverse', module: 'Money In', name: 'Reverse Receipts', description: 'Reverse receipt transaction' },
  { id: 'p40', code: 'money_in.export', module: 'Money In', name: 'Export Receipts', description: 'Export receipts' },
  {
    id: 'p92',
    code: 'money_in.import',
    module: 'Money In',
    name: 'Import Historical Receipts',
    description: 'Bulk-import historical Money In transactions from Excel, including filling in missing fields on already-posted records (Super Administrator only by default)',
  },

  // Money Out
  { id: 'p41', code: 'money_out.view', module: 'Money Out', name: 'View Payments', description: 'View vendor and supplier payments' },
  { id: 'p42', code: 'money_out.create', module: 'Money Out', name: 'Create Payments', description: 'Record outbound payment' },
  { id: 'p43', code: 'money_out.edit', module: 'Money Out', name: 'Edit Payments', description: 'Edit payment details' },
  { id: 'p44', code: 'money_out.submit', module: 'Money Out', name: 'Submit Payments', description: 'Submit payment for approval' },
  { id: 'p45', code: 'money_out.approve', module: 'Money Out', name: 'Approve Payments', description: 'Approve outbound payments' },
  { id: 'p46', code: 'money_out.post', module: 'Money Out', name: 'Post Payments', description: 'Post payment' },
  { id: 'p47', code: 'money_out.reverse', module: 'Money Out', name: 'Reverse Payments', description: 'Reverse payment transaction' },
  { id: 'p48', code: 'money_out.export', module: 'Money Out', name: 'Export Payments', description: 'Export payments' },
  {
    id: 'p93',
    code: 'money_out.import',
    module: 'Money Out',
    name: 'Import Historical Payments',
    description: 'Bulk-import historical Money Out transactions from Excel, including filling in missing fields on already-posted records (Super Administrator only by default)',
  },

  // Expenses
  { id: 'p49', code: 'expenses.view', module: 'Expenses', name: 'View Expenses', description: 'View direct site expenses' },
  { id: 'p50', code: 'expenses.create', module: 'Expenses', name: 'Create Expenses', description: 'Record direct site expenses' },
  { id: 'p51', code: 'expenses.edit', module: 'Expenses', name: 'Edit Expenses', description: 'Edit expense details' },
  { id: 'p52', code: 'expenses.submit', module: 'Expenses', name: 'Submit Expenses', description: 'Submit expense for approval' },
  { id: 'p53', code: 'expenses.approve', module: 'Expenses', name: 'Approve Expenses', description: 'Approve direct expenses' },
  { id: 'p54', code: 'expenses.post', module: 'Expenses', name: 'Post Expenses', description: 'Post direct expense' },
  { id: 'p55', code: 'expenses.reverse', module: 'Expenses', name: 'Reverse Expenses', description: 'Reverse direct expense' },
  { id: 'p56', code: 'expenses.export', module: 'Expenses', name: 'Export Expenses', description: 'Export expenses' },
  {
    id: 'p95',
    code: 'expenses.import',
    module: 'Expenses',
    name: 'Import Historical Expenses',
    description: 'Bulk-import historical Direct/Cash Expenses from Excel, including filling in missing fields on already-posted records (Super Administrator only by default)',
  },

  // Treasury
  { id: 'p57', code: 'treasury.view', module: 'Treasury', name: 'View Treasury', description: 'View liquidity, bank, cash & petty cash' },
  { id: 'p58', code: 'bank_accounts.view', module: 'Treasury', name: 'View Bank Accounts', description: 'View bank accounts and statements' },
  { id: 'p59', code: 'bank_accounts.create', module: 'Treasury', name: 'Create Bank Accounts', description: 'Add new commercial bank accounts' },
  { id: 'p60', code: 'bank_accounts.edit', module: 'Treasury', name: 'Edit Bank Accounts', description: 'Update bank details' },
  { id: 'p61', code: 'cash.view', module: 'Treasury', name: 'View Cash in Hand', description: 'View physical cash account balances' },
  { id: 'p62', code: 'petty_cash.view', module: 'Treasury', name: 'View Petty Cash', description: 'View site petty cash funds' },
  { id: 'p63', code: 'transfers.create', module: 'Treasury', name: 'Create Transfers', description: 'Execute transfer between bank and cash accounts' },
  { id: 'p64', code: 'transfers.approve', module: 'Treasury', name: 'Approve Transfers', description: 'Authorize inter-account transfers' },
  {
    id: 'p97',
    code: 'transfers.import',
    module: 'Treasury',
    name: 'Import Transfers',
    description: 'Bulk-import Bank/Cash Transfers from Excel (Super Administrator only by default)',
  },

  // Reports
  { id: 'p65', code: 'reports.view', module: 'Reports', name: 'View Reports', description: 'View P&L, Balance Sheet, Ledgers and Trial Balance' },
  { id: 'p66', code: 'reports.export', module: 'Reports', name: 'Export Reports', description: 'Export financial reports to Excel' },

  // Documents
  { id: 'p67', code: 'documents.view', module: 'Documents', name: 'View Documents', description: 'Access uploaded vouchers and attachments' },
  { id: 'p68', code: 'documents.upload', module: 'Documents', name: 'Upload Documents', description: 'Upload supporting receipts and IPC scans' },
  { id: 'p69', code: 'documents.download', module: 'Documents', name: 'Download Documents', description: 'Download document attachments' },
  { id: 'p70', code: 'documents.delete', module: 'Documents', name: 'Delete Documents', description: 'Remove attachments' },

  // Approvals
  { id: 'p71', code: 'approvals.view', module: 'Approvals', name: 'View Pending Approvals', description: 'Access pending approvals queue' },
  { id: 'p72', code: 'approvals.approve', module: 'Approvals', name: 'Approve Transactions', description: 'Approve submitted transactions' },
  { id: 'p73', code: 'approvals.reject', module: 'Approvals', name: 'Reject Transactions', description: 'Reject transactions with mandatory reason' },

  // Users & Roles
  { id: 'p74', code: 'users.view', module: 'User Management', name: 'View Users', description: 'View user directory and assignment' },
  { id: 'p75', code: 'users.create', module: 'User Management', name: 'Create Users', description: 'Invite and add new system users' },
  { id: 'p76', code: 'users.edit', module: 'User Management', name: 'Edit Users', description: 'Modify user profiles and assigned projects' },
  { id: 'p77', code: 'users.activate', module: 'User Management', name: 'Activate Users', description: 'Activate user access' },
  { id: 'p78', code: 'users.deactivate', module: 'User Management', name: 'Deactivate Users', description: 'Deactivate user accounts' },

  // Roles
  { id: 'p79', code: 'roles.view', module: 'Role Management', name: 'View Roles', description: 'View roles and their assigned permissions' },
  { id: 'p80', code: 'roles.create', module: 'Role Management', name: 'Create Roles', description: 'Define custom roles' },
  { id: 'p81', code: 'roles.edit', module: 'Role Management', name: 'Edit Roles', description: 'Edit custom role permissions' },
  { id: 'p82', code: 'roles.delete', module: 'Role Management', name: 'Delete Roles', description: 'Delete custom roles' },

  // Settings
  { id: 'p83', code: 'settings.view', module: 'Settings', name: 'View Settings', description: 'View system and appearance settings' },
  { id: 'p84', code: 'settings.edit', module: 'Settings', name: 'Edit Settings', description: 'Configure approval limits and SOD rules' },

  // Audit
  { id: 'p85', code: 'audit.view', module: 'Audit Log', name: 'View Audit Log', description: 'View full immutable audit trail' },
  { id: 'p86', code: 'audit.export', module: 'Audit Log', name: 'Export Audit Log', description: 'Export audit trail records' },

  // CRITICAL: Master Data Import (SUPER ADMINISTRATOR ONLY by default!)
  {
    id: 'p87',
    code: 'master_data.import',
    module: 'Master Data Import',
    name: 'Import Master Data',
    description: 'Bulk import Customers, Vendors, Projects, Bank Accounts and Expense Heads (Super Administrator only)',
  },

  // Business Partners
  { id: 'p88', code: 'business_partners.view', module: 'Business Partners', name: 'View Business Partners', description: 'View directors, related companies, JV partners and intercompany accounts' },
  { id: 'p89', code: 'business_partners.create', module: 'Business Partners', name: 'Create Business Partners', description: 'Register new business partner records' },
  { id: 'p90', code: 'business_partners.edit', module: 'Business Partners', name: 'Edit Business Partners', description: 'Update business partner details' },
  { id: 'p91', code: 'business_partners.export', module: 'Business Partners', name: 'Export Business Partners', description: 'Export business partner records and balances' },
];

// Grouped permissions for UI display
export const PERMISSION_MODULES: { module: string; permissions: Permission[] }[] = Array.from(
  new Set(ALL_PERMISSIONS.map((p) => p.module))
).map((moduleName) => ({
  module: moduleName,
  permissions: ALL_PERMISSIONS.filter((p) => p.module === moduleName),
}));

// All permission codes
export const ALL_PERMISSION_CODES = ALL_PERMISSIONS.map((p) => p.code);

// Default Roles specification
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-super-admin',
    code: 'super_admin',
    name: 'Super Administrator',
    description: 'Full unrestricted system access, security administration, user management, and exclusive master-data import authority.',
    isSystem: true,
    permissions: ALL_PERMISSION_CODES, // Super Admin has all permissions including master_data.import
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-accounts-manager',
    code: 'accounts_manager',
    name: 'Accounts Manager',
    description: 'Manages day-to-day accounting operations, approvals, and financial reporting. Cannot manage Super Admin security or import master data.',
    isSystem: true,
    // Note: Accounts Manager does NOT have 'master_data.import' and does NOT have super admin privilege
    permissions: ALL_PERMISSION_CODES.filter(
      (code) =>
        code !== 'master_data.import' &&
        code !== 'users.activate' &&
        code !== 'users.deactivate' &&
        code !== 'roles.create' &&
        code !== 'roles.edit' &&
        code !== 'roles.delete'
    ),
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-finance-manager',
    code: 'finance_manager',
    name: 'Finance Manager',
    description: 'Responsible for accounting operations, financial review, approvals, financial reports, receivables, payables, and treasury.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'projects.view', 'projects.export',
      'customers.view', 'customers.create', 'customers.edit', 'customers.export',
      'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.export',
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.submit', 'invoices.approve', 'invoices.post', 'invoices.reverse', 'invoices.export',
      'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.submit', 'purchases.approve', 'purchases.post', 'purchases.reverse', 'purchases.export',
      'money_in.view', 'money_in.create', 'money_in.edit', 'money_in.submit', 'money_in.approve', 'money_in.post', 'money_in.reverse', 'money_in.export',
      'money_out.view', 'money_out.create', 'money_out.edit', 'money_out.submit', 'money_out.approve', 'money_out.post', 'money_out.reverse', 'money_out.export',
      'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.submit', 'expenses.approve', 'expenses.post', 'expenses.reverse', 'expenses.export',
      'treasury.view', 'bank_accounts.view', 'cash.view', 'petty_cash.view', 'transfers.create', 'transfers.approve',
      'business_partners.view', 'business_partners.create', 'business_partners.edit', 'business_partners.export',
      'reports.view', 'reports.export',
      'documents.view', 'documents.upload', 'documents.download',
      'approvals.view', 'approvals.approve', 'approvals.reject',
      'audit.view', 'audit.export',
      'settings.view',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-accountant',
    code: 'accountant',
    name: 'Accountant',
    description: 'Daily accounting entries, invoices, purchases, expenses, receipts, payments, transfers, and general ledger maintenance.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'projects.view',
      'customers.view', 'customers.create', 'customers.edit',
      'vendors.view', 'vendors.create', 'vendors.edit',
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.submit', 'invoices.export',
      'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.submit', 'purchases.export',
      'money_in.view', 'money_in.create', 'money_in.edit', 'money_in.submit', 'money_in.export',
      'money_out.view', 'money_out.create', 'money_out.edit', 'money_out.submit', 'money_out.export',
      'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.submit', 'expenses.export',
      'treasury.view', 'bank_accounts.view', 'cash.view', 'petty_cash.view', 'transfers.create',
      'business_partners.view', 'business_partners.create', 'business_partners.edit',
      'reports.view', 'reports.export',
      'documents.view', 'documents.upload', 'documents.download',
      'approvals.view',
      'settings.view',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-ar-user',
    code: 'ar_user',
    name: 'Accounts Receivable User',
    description: 'Responsible for customers, client invoices/IPC, receipts (Money In), customer ledgers, and payment history.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'customers.view', 'customers.create', 'customers.edit', 'customers.export',
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.submit', 'invoices.export',
      'money_in.view', 'money_in.create', 'money_in.edit', 'money_in.submit', 'money_in.export',
      'reports.view',
      'documents.view', 'documents.upload', 'documents.download',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-ap-user',
    code: 'ap_user',
    name: 'Accounts Payable User',
    description: 'Responsible for vendors, purchases, vendor payments (Money Out), vendor ledgers, and payable aging.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.export',
      'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.submit', 'purchases.export',
      'money_out.view', 'money_out.create', 'money_out.edit', 'money_out.submit', 'money_out.export',
      'reports.view',
      'documents.view', 'documents.upload', 'documents.download',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-treasury-user',
    code: 'treasury_user',
    name: 'Treasury / Cashier User',
    description: 'Manages commercial bank accounts, cash in hand, petty cash, receipts, payments, and inter-account transfers.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'treasury.view', 'bank_accounts.view', 'cash.view', 'petty_cash.view',
      'money_in.view', 'money_in.create',
      'money_out.view', 'money_out.create',
      'transfers.create',
      'business_partners.view', 'business_partners.create', 'business_partners.edit',
      'reports.view',
      'documents.view', 'documents.upload', 'documents.download',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-project-accountant',
    code: 'project_accountant',
    name: 'Project Accountant',
    description: 'Manages invoices, purchases, direct expenses, and financial tracking for explicitly assigned projects only.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'projects.view',
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.submit',
      'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.submit',
      'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.submit',
      'reports.view',
      'documents.view', 'documents.upload', 'documents.download',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-viewer',
    code: 'viewer',
    name: 'Viewer',
    description: 'Read-only access across enabled modules. Cannot create, edit, delete, approve, post, reverse, or import.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'projects.view',
      'customers.view',
      'vendors.view',
      'invoices.view',
      'purchases.view',
      'money_in.view',
      'money_out.view',
      'expenses.view',
      'treasury.view',
      'business_partners.view',
      'reports.view',
      'documents.view',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// Default Workflow and Approval Limits Settings
export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  separationOfDutiesEnabled: true, // Creator cannot approve own transaction
  requireApprovalAboveOMR: 0, // All transactions go through approval workflow
  approvalLimits: [
    { roleCode: 'accountant', roleName: 'Accountant', maxAmountOMR: 1000 },
    { roleCode: 'finance_manager', roleName: 'Finance Manager', maxAmountOMR: 10000 },
    { roleCode: 'accounts_manager', roleName: 'Accounts Manager', maxAmountOMR: 50000 },
    { roleCode: 'super_admin', roleName: 'Super Administrator', maxAmountOMR: 999999999 },
    { roleCode: 'project_accountant', roleName: 'Project Accountant', maxAmountOMR: 500 },
    { roleCode: 'ar_user', roleName: 'Accounts Receivable User', maxAmountOMR: 1000 },
    { roleCode: 'ap_user', roleName: 'Accounts Payable User', maxAmountOMR: 1000 },
    { roleCode: 'treasury_user', roleName: 'Treasury User', maxAmountOMR: 2000 },
    { roleCode: 'viewer', roleName: 'Viewer', maxAmountOMR: 0 },
  ],
};
