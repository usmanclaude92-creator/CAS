/**
 * Demo Account Request & Approval Service
 * Requests are stored in Supabase (demo_requests table). Approval provisions a
 * real Supabase Auth account and a one-time sign-in link generated server-side
 * (see /api/admin/demo-requests/:id/approve) — no predictable passwords, no
 * client-side session bypass.
 */

import { getSupabaseClient } from './supabaseClient';

export interface SystemRoleInfo {
  code: string;
  name: string;
  category: 'Executive' | 'Management' | 'Accounting' | 'Treasury' | 'Audit';
  approvalLimitOMR: number;
  approvalLimitLabel: string;
  projectScope: string;
  description: string;
  responsibilities: string[];
  keyModules: string[];
  badgeColor: string;
}

export interface OneTimeSecureLink {
  link: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  dispatchedToEmail: string;
  dispatchedAt: string;
}

export interface DemoRequest {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  phone?: string;
  roleCode: string;
  roleName: string;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedAt?: string;
  oneTimeSecureLink?: OneTimeSecureLink;
}

export const VISITOR_SYSTEM_ROLES: SystemRoleInfo[] = [
  {
    code: 'super_admin',
    name: 'Super Administrator',
    category: 'Executive',
    approvalLimitOMR: 999999999,
    approvalLimitLabel: 'Unlimited Authority',
    projectScope: 'Consolidated All Corporate Projects',
    description: 'Executive governance, security administration, user directory management, master data import, and unrestricted financial authority.',
    responsibilities: [
      'Unrestricted enterprise-wide approval of all financial vouchers and invoices',
      'User security administration, project assignments, and role permission management',
      'Exclusive authority to bulk import master corporate records (Customers, Vendors, Projects)',
      'System-wide immutable audit trail inspection and compliance governance',
    ],
    keyModules: ['Master Data Import', 'User Management', 'All Financial Ledgers', 'Settings & Security', 'Audit Logs'],
    badgeColor: 'purple',
  },
  {
    code: 'accounts_manager',
    name: 'Accounts Manager',
    category: 'Management',
    approvalLimitOMR: 50000,
    approvalLimitLabel: 'Up to OMR 50,000',
    projectScope: 'All Active Projects',
    description: 'Head of Accounting Operations; oversees transactional workflows, intermediate approvals, and comprehensive financial reporting.',
    responsibilities: [
      'Review and approval of subcontractor billings, client IPCs, and expenses up to OMR 50,000',
      'Generation and sign-off on Income Statements, Balance Sheets, and Cash Flow reports',
      'Supervision of bank accounts, reconciliations, and inter-account transfers',
      'Separation of duties enforcement between data entry clerks and approval officers',
    ],
    keyModules: ['Approvals & Workflows', 'Financial Statements', 'Banking & Treasury', 'AR / AP Ledgers'],
    badgeColor: 'blue',
  },
  {
    code: 'finance_manager',
    name: 'Finance Manager',
    category: 'Management',
    approvalLimitOMR: 10000,
    approvalLimitLabel: 'Up to OMR 10,000',
    projectScope: 'All Active Projects',
    description: 'Financial controller focusing on project budgets, cost variance analysis, cash flow management, and medium-tier transaction authorization.',
    responsibilities: [
      'Approval of operational purchase orders, material invoices, and payments up to OMR 10,000',
      'Project profitability monitoring and cost-to-complete variance reviews',
      'Cash flow projections, working capital supervision, and debtor aging follow-ups',
    ],
    keyModules: ['Project Profitability', 'Purchases & Bills', 'Budget Control', 'AR/AP Aging'],
    badgeColor: 'indigo',
  },
  {
    code: 'accountant',
    name: 'Senior Accountant',
    category: 'Accounting',
    approvalLimitOMR: 1000,
    approvalLimitLabel: 'Up to OMR 1,000',
    projectScope: 'All Active Projects',
    description: 'Day-to-day operational accounting, voucher creation, double-entry bookkeeping, invoice preparation, and bank entry recording.',
    responsibilities: [
      'Recording customer invoices, Interim Payment Certificates (IPC), and supplier bills',
      'Preparing payment vouchers (Money Out), cash receipts (Money In), and journal adjustments',
      'General ledger reconciliations and transaction submission for managerial approval',
    ],
    keyModules: ['Client Invoicing (IPC)', 'Vendor Purchases', 'Money In / Money Out', 'General Journal'],
    badgeColor: 'emerald',
  },
  {
    code: 'project_accountant',
    name: 'Project Site Accountant',
    category: 'Accounting',
    approvalLimitOMR: 500,
    approvalLimitLabel: 'Up to OMR 500',
    projectScope: 'Assigned Construction Sites Only',
    description: 'Field-based accounting strictly confined to designated project sites. Manages local site petty cash, delivery vouchers, and site costs.',
    responsibilities: [
      'Strictly isolated to transactions and reports for assigned project contracts',
      'Direct entry of on-site material purchases, equipment rentals, and labor expenses',
      'Site petty cash management and subcontractor measurement vouchers',
    ],
    keyModules: ['Project Vouchers', 'Site Expenses', 'Project-Restricted Invoicing', 'Site Petty Cash'],
    badgeColor: 'amber',
  },
  {
    code: 'ar_user',
    name: 'Accounts Receivable (AR) Officer',
    category: 'Accounting',
    approvalLimitOMR: 1000,
    approvalLimitLabel: 'Up to OMR 1,000',
    projectScope: 'All Active Client Accounts',
    description: 'Specialist managing customer master files, Interim Payment Certificates (IPC), client billing schedules, and incoming payment receipts.',
    responsibilities: [
      'Preparation of contractual IPC billing certificates and progressive invoices',
      'Client collections recording (Money In), bank deposit logging, and payment allocation',
      'Customer statement reconciliation and aged debtor tracking',
    ],
    keyModules: ['Customer Directory', 'Client IPC Invoices', 'Money In Receipts', 'AR Aging Reports'],
    badgeColor: 'teal',
  },
  {
    code: 'ap_user',
    name: 'Accounts Payable (AP) Officer',
    category: 'Accounting',
    approvalLimitOMR: 1000,
    approvalLimitLabel: 'Up to OMR 1,000',
    projectScope: 'All Vendor & Subcontractor Accounts',
    description: 'Specialist handling supplier bills, subcontractor certificates, materials purchasing records, and scheduled payment vouchers.',
    responsibilities: [
      'Matching vendor bills against purchase orders and site delivery notes',
      'Preparing disbursement vouchers (Money Out) for supplier and subcontractor settlements',
      'Monitoring vendor credit terms, discount periods, and payable aging schedules',
    ],
    keyModules: ['Vendor Directory', 'Purchase Invoices', 'Money Out Payments', 'AP Aging Reports'],
    badgeColor: 'cyan',
  },
  {
    code: 'treasury_user',
    name: 'Treasury & Cashier Officer',
    category: 'Treasury',
    approvalLimitOMR: 2000,
    approvalLimitLabel: 'Up to OMR 2,000',
    projectScope: 'All Commercial Banks & Cash Boxes',
    description: 'Manages corporate bank registers, physical cash accounts, petty cash custody, and inter-account funds movement.',
    responsibilities: [
      'Maintaining primary commercial bank registers (e.g. Bank Muscat, Bank Dhofar)',
      'Custody and disbursement of central office cash and project petty cash boxes',
      'Execution of inter-bank fund transfers with dual authorization controls',
    ],
    keyModules: ['Bank Registers', 'Cash in Hand', 'Petty Cash Floats', 'Inter-Account Transfers'],
    badgeColor: 'sky',
  },
  {
    code: 'viewer',
    name: 'Compliance & Internal Auditor',
    category: 'Audit',
    approvalLimitOMR: 0,
    approvalLimitLabel: 'Read-Only (0 OMR)',
    projectScope: 'System-Wide Read-Only Visibility',
    description: 'Read-only access across all corporate accounting modules for compliance verification, external auditors, and board-level review.',
    responsibilities: [
      'Full read-only inspection of chart of accounts, ledgers, statements, and tax files',
      'Immutable audit trail verification without ability to create, edit, post, or delete',
      'Export of audited trial balances and financial workbooks',
    ],
    keyModules: ['Audit Trail Logs', 'Financial Reports', 'Read-Only Ledgers', 'Export Utilities'],
    badgeColor: 'slate',
  },
];

function mapRow(row: any): DemoRequest {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    companyName: row.company_name,
    phone: row.phone ?? undefined,
    roleCode: row.role_code,
    roleName: row.role_name,
    purpose: row.purpose ?? undefined,
    status: row.status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at ?? undefined,
    oneTimeSecureLink: row.one_time_secure_link ?? undefined,
  };
}

class DemoRequestService {
  public async getAllRequests(): Promise<DemoRequest[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data } = await client.from('demo_requests').select('*').order('requested_at', { ascending: false });
    return (data ?? []).map(mapRow);
  }

  public async submitRequest(params: {
    fullName: string;
    email: string;
    companyName: string;
    phone?: string;
    roleCode: string;
    purpose?: string;
  }): Promise<{ success: boolean; request?: DemoRequest; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const roleInfo = VISITOR_SYSTEM_ROLES.find((r) => r.code === params.roleCode) || VISITOR_SYSTEM_ROLES[0];

    const { data, error } = await client
      .from('demo_requests')
      .insert({
        full_name: params.fullName.trim(),
        email: params.email.trim().toLowerCase(),
        company_name: params.companyName.trim(),
        phone: params.phone?.trim() || null,
        role_code: roleInfo.code,
        role_name: roleInfo.name,
        purpose: params.purpose?.trim() || 'Enterprise software evaluation',
        status: 'pending',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Best-effort admin notification; the destination address stays server-side.
    fetch('/api/demo-requests/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: data.id }),
    }).catch(() => {
      // Non-critical: the request is safely persisted in Supabase regardless.
    });

    return { success: true, request: mapRow(data) };
  }

  public async updateRequestRole(requestId: string, roleCode: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };
    const roleInfo = VISITOR_SYSTEM_ROLES.find((r) => r.code === roleCode);
    if (!roleInfo) return { success: false, error: 'Unknown role.' };
    const { error } = await client
      .from('demo_requests')
      .update({ role_code: roleInfo.code, role_name: roleInfo.name })
      .eq('id', requestId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * Approves a pending request. Provisions/links a real Supabase Auth account
   * and generates a one-time sign-in link server-side (service_role only).
   */
  public async approveRequest(requestId: string): Promise<{ success: boolean; link?: string; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { success: false, error: 'No active session.' };

    const res = await fetch(`/api/admin/demo-requests/${encodeURIComponent(requestId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok || !body.success) return { success: false, error: body.error || 'Approval failed.' };
    return { success: true, link: body.link };
  }

  public async rejectRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };
    const { error } = await client.from('demo_requests').update({ status: 'rejected' }).eq('id', requestId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  public async deleteRequest(requestId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('demo_requests').delete().eq('id', requestId);
    return !error;
  }
}

export const demoRequestService = new DemoRequestService();
