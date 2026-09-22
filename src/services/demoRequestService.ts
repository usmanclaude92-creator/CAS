/**
 * Demo Account Request & Approval Service
 * Manages visitor demo access requests, role directories, and administrative approval workflows.
 */

import { authService } from './authService';

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
  token: string;
  link: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
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
  approvalToken: string;
  requestedAt: string;
  approvedAt?: string;
  approvalLink: string;
  oneTimeSecureLink?: OneTimeSecureLink;
  assignedCredentials?: {
    email: string;
    temporaryPassword?: string;
    instructions?: string;
  };
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

const STORAGE_KEY_REQUESTS = 'artify_demo_access_requests_v1';
// Destination email for administrator approval notification (DO NOT display in UI)
const ADMIN_NOTIFICATION_DESTINATION = 'usmanclaude92@gmail.com';

class DemoRequestService {
  constructor() {
    this.syncRequestsWithServer().catch(() => {});
  }

  /**
   * Synchronizes demo requests with the central server
   * allowing cross-device admin review and link generation.
   */
  public async syncRequestsWithServer(): Promise<DemoRequest[]> {
    try {
      const res = await fetch('/api/demo-requests');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.requests)) {
          const serverList: DemoRequest[] = data.requests;
          const localList = this.getStoredRequests();
          const map = new Map<string, DemoRequest>();
          localList.forEach((r) => map.set(r.id, r));
          serverList.forEach((r) => map.set(r.id, { ...(map.get(r.id) || {}), ...r }));
          const merged = Array.from(map.values());
          this.saveRequests(merged);
          return merged;
        }
      }
    } catch (e) {
      console.warn('[DemoRequestService] Sync note:', e);
    }
    return this.getStoredRequests();
  }

  private getStoredRequests(): DemoRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_REQUESTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveRequests(requests: DemoRequest[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    } catch (err) {
      console.error('Failed to save demo requests to localStorage', err);
    }
  }

  /**
   * Retrieves all visitor demo requests
   */
  public getAllRequests(): DemoRequest[] {
    return this.getStoredRequests();
  }

  /**
   * Retrieves a specific demo request by its ID
   */
  public getRequestById(id: string): DemoRequest | null {
    const list = this.getStoredRequests();
    return list.find((r) => r.id === id) || null;
  }

  /**
   * Retrieves a demo request by its secure approval token
   */
  public getRequestByToken(token: string): DemoRequest | null {
    const list = this.getStoredRequests();
    return list.find((r) => r.approvalToken === token) || null;
  }

  /**
   * Submits a new demo account request and dispatches an approval notification to the system administrator
   */
  public async submitRequest(params: {
    fullName: string;
    email: string;
    companyName: string;
    phone?: string;
    roleCode: string;
    purpose?: string;
  }): Promise<{ success: boolean; request: DemoRequest; error?: string }> {
    const roleInfo = VISITOR_SYSTEM_ROLES.find((r) => r.code === params.roleCode) || VISITOR_SYSTEM_ROLES[0];
    const requestId = `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const approvalToken = `tok_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    
    // Construct the direct approval link
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const approvalLink = `${origin}/?action=approve_demo&requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(approvalToken)}&role=${encodeURIComponent(roleInfo.code)}`;

    const newRequest: DemoRequest = {
      id: requestId,
      fullName: params.fullName.trim(),
      email: params.email.trim(),
      companyName: params.companyName.trim(),
      phone: params.phone?.trim() || undefined,
      roleCode: roleInfo.code,
      roleName: roleInfo.name,
      purpose: params.purpose?.trim() || 'Enterprise software evaluation',
      status: 'pending',
      approvalToken,
      requestedAt: new Date().toISOString(),
      approvalLink,
    };

    // Save locally
    const existing = this.getStoredRequests();
    existing.unshift(newRequest);
    this.saveRequests(existing);

    // Save to central server so requests are accessible from any system
    try {
      fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest),
      }).catch((e) => console.warn('[DemoRequestService] Central server request save note:', e));
    } catch {
      // ignore
    }

    // Dispatch approval email to administrator
    try {
      await this.dispatchAdminApprovalNotification(newRequest, approvalLink);
    } catch (err) {
      console.warn('Admin notification dispatch encountered an issue, request is securely stored:', err);
    }

    return {
      success: true,
      request: newRequest,
    };
  }

  /**
   * Dispatches the approval notification to the administrator
   * Note: The email address is kept strictly server-side/service-internal and NEVER displayed in UI.
   */
  private async dispatchAdminApprovalNotification(request: DemoRequest, approvalLink: string): Promise<void> {
    const payload = {
      _subject: `[Action Required] Demo Account Approval Request: ${request.fullName} - ${request.roleName}`,
      applicant_name: request.fullName,
      applicant_email: request.email,
      company_name: request.companyName,
      contact_phone: request.phone || 'Not provided',
      requested_role: request.roleName,
      evaluation_purpose: request.purpose || 'Software Evaluation',
      submission_time: new Date(request.requestedAt).toLocaleString(),
      request_reference: request.id,
      one_click_approval_link: approvalLink,
      message: `A visitor has requested demo access for the Artify Construction Accounting System.\n\nApplicant: ${request.fullName} (${request.email})\nCompany: ${request.companyName}\nRole Requested: ${request.roleName}\n\nTo review and authorize this demo account, click the approval link below:\n${approvalLink}`,
    };

    try {
      // POST to formsubmit ajax endpoint
      const response = await fetch(`https://formsubmit.co/ajax/${ADMIN_NOTIFICATION_DESTINATION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('FormSubmit endpoint response status:', response.status);
      }
    } catch (networkError) {
      // Offline/sandbox fallback - request is saved in localStorage so the approval link remains fully functional
      console.warn('Email dispatch network notice (saved locally):', networkError);
    }
  }

  /**
   * Approves a demo request and activates demo access credentials
   */
  public async approveRequest(
    requestId: string,
    token: string
  ): Promise<{ success: boolean; request?: DemoRequest; error?: string }> {
    const list = this.getStoredRequests();
    const index = list.findIndex((r) => r.id === requestId && r.approvalToken === token);

    if (index === -1) {
      return { success: false, error: 'Invalid or expired approval token.' };
    }

    const target = list[index];
    target.status = 'approved';
    target.approvedAt = new Date().toISOString();
    target.assignedCredentials = {
      email: target.email,
      temporaryPassword: `ArtifyDemo@${new Date().getFullYear()}`,
      instructions: `Your demo access for role '${target.roleName}' has been authorized. You can log in using your email.`,
    };

    list[index] = target;
    this.saveRequests(list);

    return {
      success: true,
      request: target,
    };
  }

  /**
   * Rejects a demo request
   */
  public async rejectRequest(
    requestId: string,
    token: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredRequests();
    const index = list.findIndex((r) => r.id === requestId && r.approvalToken === token);

    if (index === -1) {
      return { success: false, error: 'Invalid or expired approval token.' };
    }

    const target = list[index];
    target.status = 'rejected';
    list[index] = target;
    this.saveRequests(list);

    return { success: true };
  }

  /**
   * Generates a one-time secure access link for an approved demo request,
   * updates the request state, and dispatches the link to the requested user's email.
   */
  public async generateAndSendOneTimeSecureLink(
    requestId: string,
    customExpiryHours: number = 48,
    roleCodeOverride?: string
  ): Promise<{ success: boolean; request?: DemoRequest; link?: string; error?: string }> {
    const list = this.getStoredRequests();
    const index = list.findIndex((r) => r.id === requestId);

    if (index === -1) {
      return { success: false, error: 'Demo request record not found.' };
    }

    const target = list[index];

    // If role was updated by admin
    if (roleCodeOverride) {
      const roleInfo = VISITOR_SYSTEM_ROLES.find((r) => r.code === roleCodeOverride);
      if (roleInfo) {
        target.roleCode = roleInfo.code;
        target.roleName = roleInfo.name;
      }
    }

    // Generate unique secure one-time token
    const uniqueHash = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    const token = `dsec_${uniqueHash}`;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const secureLink = `${origin}/?demo_access_token=${token}&requestId=${encodeURIComponent(target.id)}`;
    const expiresAt = new Date(Date.now() + customExpiryHours * 60 * 60 * 1000).toISOString();

    const oneTimeSecureLink: OneTimeSecureLink = {
      token,
      link: secureLink,
      createdAt: new Date().toISOString(),
      expiresAt,
      used: false,
      dispatchedToEmail: target.email,
      dispatchedAt: new Date().toISOString(),
    };

    target.status = 'approved';
    target.approvedAt = new Date().toISOString();
    target.oneTimeSecureLink = oneTimeSecureLink;
    target.assignedCredentials = {
      email: target.email,
      instructions: `Your one-time demo access link for '${target.roleName}' has been generated and sent to ${target.email}.`,
    };

    list[index] = target;
    this.saveRequests(list);

    // Persist approval and generated one-time link state to central server
    try {
      fetch(`/api/demo-requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customExpiryHours, roleCodeOverride }),
      }).catch((e) => console.warn('[DemoRequestService] Server approval sync note:', e));
    } catch {
      // ignore
    }

    // Dispatch email to the requested visitor's email address
    await this.dispatchUserOneTimeLinkNotification(target, secureLink, expiresAt);

    return {
      success: true,
      request: target,
      link: secureLink,
    };
  }

  /**
   * Dispatches the single-use secure demo link directly to the requested user's email address
   */
  private async dispatchUserOneTimeLinkNotification(
    request: DemoRequest,
    secureLink: string,
    expiresAt: string
  ): Promise<void> {
    const payload = {
      _subject: `Your Artify ERP Demo Access is Approved: One-Time Secure Link (${request.roleName})`,
      recipient_name: request.fullName,
      recipient_email: request.email,
      company_name: request.companyName || 'Corporate Evaluation',
      assigned_role: request.roleName,
      one_time_secure_link: secureLink,
      link_valid_until: new Date(expiresAt).toLocaleString(),
      message: `Dear ${request.fullName},\n\nYour request for demo access to Artify Construction Accounting System as "${request.roleName}" has been approved by the system administrator.\n\nUse your single-use secure activation link below to enter your authorized workspace:\n${secureLink}\n\nNotice: This is a one-time activation link valid until ${new Date(expiresAt).toLocaleString()}. Upon clicking, your temporary demo session will automatically initialize without requiring manual password entry.\n\nBest regards,\nArtify Solutions Security Team`,
    };

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(request.email)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('One-time link email dispatch status:', response.status);
      }
    } catch (networkError) {
      console.warn('One-time link email network dispatch note:', networkError);
    }
  }

  /**
   * Redeems a one-time secure link token, validates single-use & expiry,
   * marks it as used, and logs the visitor in with their approved role.
   */
  public async redeemOneTimeToken(
    token: string,
    requestId?: string
  ): Promise<{ success: boolean; request?: DemoRequest; error?: string }> {
    // 1. First validate with central server so links work across any device / browser
    try {
      const serverRes = await fetch('/api/demo-requests/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, requestId }),
      });
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (!serverData.success) {
          return { success: false, error: serverData.error };
        }
        const req: DemoRequest = serverData.request;
        const list = this.getStoredRequests();
        const idx = list.findIndex((r) => r.id === req.id);
        if (idx !== -1) {
          list[idx] = req;
        } else {
          list.unshift(req);
        }
        this.saveRequests(list);

        // Auto-login the guest with approved role permissions
        authService.loginAsAuthorizedDemoGuest({
          fullName: req.fullName,
          email: req.email,
          roleCode: req.roleCode,
          roleName: req.roleName,
          companyName: req.companyName,
        });

        return {
          success: true,
          request: req,
        };
      }
    } catch (netErr) {
      console.warn('[DemoRequestService] Central server redeem fallback to local cache:', netErr);
    }

    // 2. Fallback to local storage validation if server is offline
    const list = this.getStoredRequests();
    
    // Find matching request by token or requestId
    let index = -1;
    if (requestId) {
      index = list.findIndex((r) => r.id === requestId && r.oneTimeSecureLink?.token === token);
    }
    if (index === -1) {
      index = list.findIndex((r) => r.oneTimeSecureLink?.token === token);
    }

    if (index === -1) {
      return {
        success: false,
        error: 'Invalid or unrecognized one-time demo access token. Please verify your activation link or request a new demo account.',
      };
    }

    const req = list[index];
    const linkInfo = req.oneTimeSecureLink;

    if (!linkInfo) {
      return {
        success: false,
        error: 'No active one-time access link found for this request.',
      };
    }

    // Check if single-use token was already consumed
    if (linkInfo.used) {
      const usedTime = linkInfo.usedAt ? new Date(linkInfo.usedAt).toLocaleString() : 'previously';
      return {
        success: false,
        error: `This one-time demo access link was already redeemed on ${usedTime}. Single-use links cannot be re-used. Please submit a new demo access request to continue exploring.`,
      };
    }

    // Check if token has expired
    if (new Date() > new Date(linkInfo.expiresAt)) {
      return {
        success: false,
        error: `This one-time demo access link expired on ${new Date(linkInfo.expiresAt).toLocaleString()}. Please submit a new demo access request.`,
      };
    }

    // Mark single-use token as consumed immediately
    linkInfo.used = true;
    linkInfo.usedAt = new Date().toISOString();
    req.oneTimeSecureLink = linkInfo;
    list[index] = req;
    this.saveRequests(list);

    // Auto-login the guest with approved role permissions
    authService.loginAsAuthorizedDemoGuest({
      fullName: req.fullName,
      email: req.email,
      roleCode: req.roleCode,
      roleName: req.roleName,
      companyName: req.companyName,
    });

    return {
      success: true,
      request: req,
    };
  }

  /**
   * Deletes a request from records
   */
  public deleteRequest(requestId: string): boolean {
    const list = this.getStoredRequests();
    const filtered = list.filter((r) => r.id !== requestId);
    if (filtered.length !== list.length) {
      this.saveRequests(filtered);
      try {
        fetch(`/api/demo-requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' }).catch(() => {});
      } catch {
        // ignore
      }
      return true;
    }
    return false;
  }
}

export const demoRequestService = new DemoRequestService();
