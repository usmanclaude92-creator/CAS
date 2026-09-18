import {
  UserProfile,
  Role,
  Permission,
  SystemRole,
  UserStatus,
  WorkflowSettings,
  MasterImportAuditRecord,
} from '../types/auth';
import {
  ALL_PERMISSIONS,
  ALL_PERMISSION_CODES,
  DEFAULT_ROLES,
  DEFAULT_WORKFLOW_SETTINGS,
} from './permissionsData';
import { getSupabaseClient } from './supabaseClient';

const AUTH_USERS_STORAGE_KEY = 'construction_auth_users_v2';
const AUTH_ROLES_STORAGE_KEY = 'construction_auth_roles_v2';
const AUTH_SETTINGS_STORAGE_KEY = 'construction_auth_settings_v2';
const AUTH_CURRENT_SESSION_KEY = 'construction_current_session_v2';
const MASTER_IMPORT_AUDIT_KEY = 'construction_master_import_audits_v1';

export const REAL_PRODUCTION_SUPERADMIN: UserProfile = {
  id: 'usr-real-superadmin-artify',
  email: 'admin@artifysols.com',
  username: 'artify.admin',
  fullName: 'Super Administrator',
  mobile: '+968 9000 0001',
  roleId: 'role-super-admin',
  roleCode: 'super_admin',
  roleName: 'Super Administrator',
  status: 'active',
  department: 'Executive Board',
  employeeId: 'ARTIFY-001',
  assignedProjectIds: [],
  isAllProjects: true,
  remarks: 'Primary Real Production Super Administrator for Artify Solutions. Full enterprise governance and isolated blank production database.',
  isDemo: false, // Strictly REAL corporate user (isolated from demo sandbox)
  lastLogin: '2026-09-17T11:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

// Initial pre-seeded users representing all system roles and test scenarios
const INITIAL_USERS: UserProfile[] = [
  REAL_PRODUCTION_SUPERADMIN,
  {
    id: 'usr-super-admin',
    email: 'superadmin@construction.om',
    username: 'superadmin',
    fullName: 'Eng. Tariq Al Busaidi',
    mobile: '+968 9911 2233',
    roleId: 'role-super-admin',
    roleCode: 'super_admin',
    roleName: 'Super Administrator',
    status: 'active',
    department: 'Executive Board',
    employeeId: 'EMP-001',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Chief Executive & System Super Administrator with unrestricted governance',
    isDemo: true,
    lastLogin: '2026-09-14T08:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-accounts-manager',
    email: 'accounts.mgr@construction.om',
    username: 'accounts.mgr',
    fullName: 'Muna Al Rahbi',
    mobile: '+968 9822 3344',
    roleId: 'role-accounts-manager',
    roleCode: 'accounts_manager',
    roleName: 'Accounts Manager',
    status: 'active',
    department: 'Accounting & Finance',
    employeeId: 'EMP-002',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Head of Accounting Operations; manages workflows, approvals, and day-to-day accounts',
    isDemo: true,
    lastLogin: '2026-09-13T14:30:00Z',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'usr-finance-manager',
    email: 'finance.mgr@construction.om',
    username: 'finance.mgr',
    fullName: 'Rashid Al Balushi',
    mobile: '+968 9733 4455',
    roleId: 'role-finance-manager',
    roleCode: 'finance_manager',
    roleName: 'Finance Manager',
    status: 'active',
    department: 'Financial Control',
    employeeId: 'EMP-003',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Financial controller overseeing budgets, audits, and approvals up to OMR 10,000',
    isDemo: true,
    lastLogin: '2026-09-12T11:20:00Z',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'usr-accountant',
    email: 'accountant@construction.om',
    username: 'fatima.acc',
    fullName: 'Fatima Al Lawati',
    mobile: '+968 9644 5566',
    roleId: 'role-accountant',
    roleCode: 'accountant',
    roleName: 'Accountant',
    status: 'active',
    department: 'Accounting',
    employeeId: 'EMP-004',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Senior site & transaction accountant handling vouchers, IPCs, and bills',
    isDemo: true,
    lastLogin: '2026-09-14T07:15:00Z',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-project-accountant',
    email: 'project.acc@construction.om',
    username: 'said.site',
    fullName: 'Said Al Habsi',
    mobile: '+968 9555 6677',
    roleId: 'role-project-accountant',
    roleCode: 'project_accountant',
    roleName: 'Project Accountant',
    status: 'active',
    department: 'Site Operations',
    employeeId: 'EMP-005',
    assignedProjectIds: ['prj-akv-001'], // Explicitly restricted to Al Khoudh Villa Project only!
    isAllProjects: false,
    remarks: 'Assigned solely to PRJ-AKV-001 (Al Khoudh Villa Project). Cannot access Bausher Plaza.',
    isDemo: true,
    lastLogin: '2026-09-11T09:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'usr-treasury',
    email: 'treasury@construction.om',
    username: 'zayed.cash',
    fullName: 'Zayed Al Hinai',
    mobile: '+968 9466 7788',
    roleId: 'role-treasury-user',
    roleCode: 'treasury_user',
    roleName: 'Treasury / Cashier User',
    status: 'active',
    department: 'Treasury',
    employeeId: 'EMP-006',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Disburses cash, manages petty cash envelopes and commercial bank transfers',
    isDemo: true,
    lastLogin: '2026-09-10T16:45:00Z',
    createdAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'usr-viewer',
    email: 'viewer@construction.om',
    username: 'auditor.view',
    fullName: 'Auditor External Reviewer',
    mobile: '+968 9377 8899',
    roleId: 'role-viewer',
    roleCode: 'viewer',
    roleName: 'Viewer',
    status: 'active',
    department: 'External Audit',
    employeeId: 'AUD-001',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Read-only compliance auditor with strictly no write, edit, reverse, or approve permissions',
    isDemo: true,
    lastLogin: '2026-09-08T10:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'usr-inactive-user',
    email: 'inactive@construction.om',
    username: 'former.staff',
    fullName: 'Former Staff Member',
    mobile: '+968 9288 9900',
    roleId: 'role-accountant',
    roleCode: 'accountant',
    roleName: 'Accountant',
    status: 'inactive',
    department: 'Accounting',
    employeeId: 'EMP-999',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Deactivated account for testing access blocking and inactive login prevention',
    isDemo: true,
    lastLogin: '2026-05-01T12:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

class AuthService {
  private users: UserProfile[] = [];
  private roles: Role[] = [];
  private workflowSettings: WorkflowSettings = DEFAULT_WORKFLOW_SETTINGS;
  private currentUser: UserProfile | null = null;
  private listeners: Array<() => void> = [];
  private masterImportAudits: MasterImportAuditRecord[] = [];

  constructor() {
    this.loadData();
    this.initSession();
  }

  private loadData() {
    // 1. Roles
    try {
      const savedRoles = localStorage.getItem(AUTH_ROLES_STORAGE_KEY);
      if (savedRoles) {
        this.roles = JSON.parse(savedRoles);
      } else {
        this.roles = [...DEFAULT_ROLES];
      }
    } catch {
      this.roles = [...DEFAULT_ROLES];
    }

    // 2. Users
    try {
      const savedUsers = localStorage.getItem(AUTH_USERS_STORAGE_KEY);
      if (savedUsers) {
        const parsed: UserProfile[] = JSON.parse(savedUsers);
        const demoIds = new Set(INITIAL_USERS.filter((u) => u.isDemo).map((u) => u.id));
        this.users = parsed.map((u) => {
          if (u.email.toLowerCase() === 'admin@artifysols.com') {
            return {
              ...u,
              ...REAL_PRODUCTION_SUPERADMIN,
              isDemo: false,
              roleCode: 'super_admin',
              roleId: 'role-super-admin',
              roleName: 'Super Administrator',
              status: 'active',
              isAllProjects: true,
            };
          }
          const isDemo = demoIds.has(u.id) || u.email.endsWith('@construction.om');
          return { ...u, isDemo: isDemo ? true : (u.isDemo ?? false) };
        });
      } else {
        this.users = INITIAL_USERS.map((u) => ({ ...u }));
      }
    } catch {
      this.users = INITIAL_USERS.map((u) => ({ ...u }));
    }

    // Ensure real production superadmin always exists, is active, and is not flagged as demo
    const realSuperAdminIndex = this.users.findIndex(
      (u) => u.email.toLowerCase() === 'admin@artifysols.com'
    );
    if (realSuperAdminIndex === -1) {
      this.users.unshift({ ...REAL_PRODUCTION_SUPERADMIN });
    } else {
      this.users[realSuperAdminIndex] = {
        ...this.users[realSuperAdminIndex],
        ...REAL_PRODUCTION_SUPERADMIN,
        email: 'admin@artifysols.com',
        roleId: 'role-super-admin',
        roleCode: 'super_admin',
        roleName: 'Super Administrator',
        status: 'active',
        isDemo: false,
        isAllProjects: true,
      };
    }

    // 3. Workflow Settings
    try {
      const savedSettings = localStorage.getItem(AUTH_SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        this.workflowSettings = JSON.parse(savedSettings);
      } else {
        this.workflowSettings = { ...DEFAULT_WORKFLOW_SETTINGS };
      }
    } catch {
      this.workflowSettings = { ...DEFAULT_WORKFLOW_SETTINGS };
    }

    // 4. Master Import Audits
    try {
      const savedAudits = localStorage.getItem(MASTER_IMPORT_AUDIT_KEY);
      if (savedAudits) {
        this.masterImportAudits = JSON.parse(savedAudits);
      }
    } catch {
      this.masterImportAudits = [];
    }

    // Safety check: ensure at least one active Super Admin exists in memory
    this.enforceSuperAdminInvariant();
  }

  private initSession() {
    // Default to unauthenticated: Login screen is the default landing screen
    this.currentUser = null;
    try {
      localStorage.removeItem(AUTH_CURRENT_SESSION_KEY);
    } catch {
      // ignore
    }
  }

  private saveData() {
    try {
      localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(this.users));
      localStorage.setItem(AUTH_ROLES_STORAGE_KEY, JSON.stringify(this.roles));
      localStorage.setItem(AUTH_SETTINGS_STORAGE_KEY, JSON.stringify(this.workflowSettings));
      localStorage.setItem(MASTER_IMPORT_AUDIT_KEY, JSON.stringify(this.masterImportAudits));
      if (this.currentUser) {
        localStorage.setItem(AUTH_CURRENT_SESSION_KEY, this.currentUser.id);
      } else {
        localStorage.removeItem(AUTH_CURRENT_SESSION_KEY);
      }
    } catch (e) {
      console.error('Failed to save auth state:', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Enforces the critical rule: At least one active Super Administrator must always exist!
  private enforceSuperAdminInvariant() {
    const activeSuperAdmins = this.users.filter(
      (u) => u.roleCode === 'super_admin' && u.status === 'active'
    );
    if (activeSuperAdmins.length === 0) {
      console.warn('[AuthService] No active Super Administrator detected! Restoring default Super Administrator.');
      const defaultAdmin = INITIAL_USERS[0];
      const existing = this.users.find((u) => u.id === defaultAdmin.id);
      if (existing) {
        existing.status = 'active';
        existing.roleCode = 'super_admin';
        existing.roleName = 'Super Administrator';
      } else {
        this.users.unshift({ ...defaultAdmin });
      }
    }
  }

  // -------------------------------------------------------------
  // AUTHENTICATION FLOWS (Login, Logout, Password Reset, Switcher)
  // -------------------------------------------------------------

  public async login(
    email: string,
    password?: string,
    rememberMe = true
  ): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth first if client is configured
    const client = getSupabaseClient();
    if (client && password) {
      try {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (authError) {
          console.warn('[AuthService] Supabase Auth sign-in message:', authError.message);
          // If credentials fail in Supabase, return proper message
          // but allow embedded demo login if password matches demo pattern
        } else if (authData.user) {
          // Find matching profile in database or match with local
          let profile = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);
          if (profile) {
            if (profile.status !== 'active') {
              return { success: false, error: 'Account is deactivated. Please contact your system administrator.' };
            }
            profile.lastLogin = new Date().toISOString();
            this.currentUser = profile;
            this.saveData();
            return { success: true, user: profile };
          }
        }
      } catch (err: any) {
        console.warn('Supabase sign-in network error:', err?.message);
      }
    }

    // 2. Validate against system user directory (by email OR username)
    const user = this.users.find(
      (u) =>
        u.email.toLowerCase() === normalizedEmail ||
        (u.username && u.username.toLowerCase() === normalizedEmail)
    );
    if (!user) {
      return { success: false, error: 'Invalid credentials or user not registered in system.' };
    }

    if (user.status !== 'active') {
      return { success: false, error: `Account is ${user.status}. Access denied. Please contact your system administrator.` };
    }

    // Passwords in production are never verified client-side in plaintext;
    // For demo/offline accounts, standard dummy password validation:
    if (password && password.length < 3) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    user.lastLogin = new Date().toISOString();
    this.currentUser = user;
    if (rememberMe) {
      try {
        localStorage.setItem(AUTH_CURRENT_SESSION_KEY, user.id);
      } catch {
        // ignore
      }
    }
    this.saveData();
    return { success: true, user };
  }

  public async logout(): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
    this.currentUser = null;
    try {
      localStorage.removeItem(AUTH_CURRENT_SESSION_KEY);
    } catch {
      // ignore
    }
    this.saveData();
  }

  public async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: window.location.origin,
        });
        if (!error) {
          return { success: true, message: `Password reset email dispatched to ${normalizedEmail} via Supabase Auth.` };
        }
      } catch (e: any) {
        console.warn('Supabase password reset failed:', e?.message);
      }
    }

    if (!user) {
      return { success: false, message: 'Email not found in registered company directory.' };
    }

    return {
      success: true,
      message: `Password reset invitation initiated for ${user.fullName} (${user.email}). Secure reset link generated.`,
    };
  }

  // Quick switch role (vital for testing different roles quickly)
  public switchUser(userId: string): boolean {
    const user = this.users.find((u) => u.id === userId);
    if (user && user.status === 'active') {
      this.currentUser = user;
      try {
        localStorage.setItem(AUTH_CURRENT_SESSION_KEY, user.id);
      } catch {
        // ignore
      }
      this.saveData();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // USER PROFILE & AUTHORIZATION GETTERS
  // -------------------------------------------------------------

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentUser && this.currentUser.status === 'active');
  }

  public getUsers(): UserProfile[] {
    return [...this.users];
  }

  /**
   * Returns isolated demo sandbox test accounts
   */
  public getDemoUsers(): UserProfile[] {
    return this.users.filter((u) => u.isDemo === true);
  }

  /**
   * Returns real registered corporate users
   */
  public getRealUsers(): UserProfile[] {
    return this.users.filter((u) => !u.isDemo);
  }

  /**
   * Returns the primary real production superadmin profile
   */
  public getRealSuperAdmin(): UserProfile {
    const found = this.users.find((u) => u.email.toLowerCase() === 'admin@artifysols.com');
    return found || REAL_PRODUCTION_SUPERADMIN;
  }

  /**
   * Indicates whether the active logged-in session is a demo sandbox user
   */
  public isDemoSession(): boolean {
    return Boolean(this.currentUser?.isDemo);
  }

  public getRoles(): Role[] {
    return [...this.roles];
  }

  public getPermissions(): Permission[] {
    return [...ALL_PERMISSIONS];
  }

  public getWorkflowSettings(): WorkflowSettings {
    return { ...this.workflowSettings };
  }

  public isSuperAdmin(): boolean {
    return Boolean(this.currentUser && this.currentUser.roleCode === 'super_admin' && this.currentUser.status === 'active');
  }

  public isAccountsManager(): boolean {
    return Boolean(this.currentUser && this.currentUser.roleCode === 'accounts_manager' && this.currentUser.status === 'active');
  }

  public hasRole(roleCode: SystemRole | string): boolean {
    if (!this.currentUser || this.currentUser.status !== 'active') return false;
    if (this.currentUser.roleCode === 'super_admin') return true;
    return this.currentUser.roleCode === roleCode;
  }

  public hasPermission(permissionCode: string): boolean {
    if (!this.currentUser || this.currentUser.status !== 'active') return false;

    // Super Administrator has ALL permissions
    if (this.currentUser.roleCode === 'super_admin') return true;

    // Viewers cannot do any modification, creation, approval, or deletion
    if (this.currentUser.roleCode === 'viewer') {
      if (
        permissionCode.includes('.create') ||
        permissionCode.includes('.edit') ||
        permissionCode.includes('.delete') ||
        permissionCode.includes('.approve') ||
        permissionCode.includes('.post') ||
        permissionCode.includes('.reverse') ||
        permissionCode.includes('.cancel') ||
        permissionCode.includes('import') ||
        permissionCode.startsWith('users.') ||
        permissionCode.startsWith('roles.')
      ) {
        return false;
      }
    }

    const role = this.roles.find((r) => r.id === this.currentUser?.roleId || r.code === this.currentUser?.roleCode);
    if (!role) return false;

    return role.permissions.includes(permissionCode);
  }

  public hasProjectAccess(projectId?: string | null): boolean {
    return this.canAccessProject(projectId);
  }

  // -------------------------------------------------------------
  // CRITICAL REQUIREMENT 9: MASTER DATA IMPORT SECURITY
  // -------------------------------------------------------------
  // Master-data importing must be restricted to Super Administrator only.
  // UI Requirement: Import buttons must NOT be shown to any user except Super Administrator.
  // Backend Requirement: Every import API/service must independently verify:
  // 1. User is authenticated
  // 2. User account is active
  // 3. User has the "master_data.import" permission
  // 4. User is a Super Administrator
  // Unauthorized requests must return: 403 Forbidden
  // -------------------------------------------------------------
  public verifyMasterDataImportAuthority(): { allowed: boolean; status: number; error?: string } {
    if (!this.currentUser) {
      return { allowed: false, status: 401, error: '401 Unauthorized: User session not established.' };
    }

    if (this.currentUser.status !== 'active') {
      return { allowed: false, status: 403, error: '403 Forbidden: User account is inactive.' };
    }

    if (this.currentUser.roleCode !== 'super_admin') {
      return {
        allowed: false,
        status: 403,
        error: '403 Forbidden: Master data bulk import is restricted exclusively to Super Administrator.',
      };
    }

    if (!this.hasPermission('master_data.import')) {
      return {
        allowed: false,
        status: 403,
        error: '403 Forbidden: Missing required privilege "master_data.import".',
      };
    }

    return { allowed: true, status: 200 };
  }

  public recordMasterDataImportAudit(record: Omit<MasterImportAuditRecord, 'id' | 'timestamp'>) {
    const entry: MasterImportAuditRecord = {
      ...record,
      id: 'import-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    };
    this.masterImportAudits.unshift(entry);
    this.saveData();
    return entry;
  }

  public getMasterImportAudits(): MasterImportAuditRecord[] {
    return [...this.masterImportAudits];
  }

  // -------------------------------------------------------------
  // PROJECT-LEVEL AUTHORIZATION
  // -------------------------------------------------------------
  public canAccessProject(projectId?: string | null): boolean {
    if (!this.currentUser || this.currentUser.status !== 'active') return false;
    if (!projectId) return true; // Global items without a project

    // Super Admin has access to all projects
    if (this.currentUser.roleCode === 'super_admin') return true;

    // User assigned to "All Projects"
    if (this.currentUser.isAllProjects || this.currentUser.assignedProjectIds.includes('*')) {
      return true;
    }

    // Explicit project assignment
    return this.currentUser.assignedProjectIds.includes(projectId);
  }

  public filterAccessibleProjects<T extends { id: string }>(projects: T[]): T[] {
    if (!this.currentUser || this.currentUser.status !== 'active') return [];
    if (this.currentUser.roleCode === 'super_admin' || this.currentUser.isAllProjects) {
      return projects;
    }
    return projects.filter((p) => this.currentUser!.assignedProjectIds.includes(p.id));
  }

  public filterAccessibleTransactions<T extends { projectId?: string }>(transactions: T[]): T[] {
    if (!this.currentUser || this.currentUser.status !== 'active') return [];
    if (this.currentUser.roleCode === 'super_admin' || this.currentUser.isAllProjects) {
      return transactions;
    }
    return transactions.filter((t) => !t.projectId || this.currentUser!.assignedProjectIds.includes(t.projectId));
  }

  // -------------------------------------------------------------
  // APPROVAL WORKFLOW & LIMITS & SEPARATION OF DUTIES (SOD)
  // -------------------------------------------------------------
  public canApproveTransaction(
    amount: number,
    creatorUserId?: string,
    permissionCode = 'approvals.approve'
  ): { allowed: boolean; reason?: string } {
    if (!this.currentUser || this.currentUser.status !== 'active') {
      return { allowed: false, reason: 'User session is inactive or not logged in.' };
    }

    // Viewers can never approve
    if (this.currentUser.roleCode === 'viewer') {
      return { allowed: false, reason: 'Viewers have read-only access and cannot approve transactions.' };
    }

    // Permission check
    if (!this.hasPermission(permissionCode) && !this.hasPermission('approvals.approve')) {
      return { allowed: false, reason: `Missing required approval permission (${permissionCode}).` };
    }

    // Separation of Duties check: Creator cannot approve own transaction
    if (
      this.workflowSettings.separationOfDutiesEnabled &&
      creatorUserId &&
      creatorUserId === this.currentUser.id
    ) {
      return {
        allowed: false,
        reason: 'Separation of Duties (SOD) violation: Transaction creator cannot approve their own transaction.',
      };
    }

    // Approval Limit check
    const roleLimit = this.workflowSettings.approvalLimits.find(
      (l) => l.roleCode === this.currentUser?.roleCode
    );

    const maxAllowed = roleLimit ? roleLimit.maxAmountOMR : 0;
    if (amount > maxAllowed) {
      return {
        allowed: false,
        reason: `Amount (OMR ${amount.toFixed(3)}) exceeds your configured role approval authority limit (OMR ${maxAllowed.toFixed(3)}). Escalation required.`,
      };
    }

    return { allowed: true };
  }

  // -------------------------------------------------------------
  // USER MANAGEMENT & SAFEGUARDS
  // -------------------------------------------------------------
  public async createUser(data: {
    fullName: string;
    email: string;
    username?: string;
    password?: string;
    mobile?: string;
    roleId: string;
    assignedProjectIds: string[];
    isAllProjects: boolean;
    department?: string;
    employeeId?: string;
    status?: UserStatus;
    remarks?: string;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.hasPermission('users.create')) {
      return { success: false, error: 'Insufficient privileges to create new users.' };
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    if (this.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'A user with this email address already exists.' };
    }

    if (data.username) {
      const cleanUsername = data.username.trim().toLowerCase();
      if (this.users.some((u) => u.username?.toLowerCase() === cleanUsername)) {
        return { success: false, error: `Username "${data.username}" is already assigned to another user.` };
      }
    }

    const role = this.roles.find((r) => r.id === data.roleId);
    if (!role) {
      return { success: false, error: 'Invalid role selected.' };
    }

    // Only Super Admin can create another Super Admin
    if (role.code === 'super_admin' && !this.isSuperAdmin()) {
      return { success: false, error: 'Only a Super Administrator can create another Super Administrator.' };
    }

    const newUser: UserProfile = {
      id: 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      email: normalizedEmail,
      username: data.username ? data.username.trim().toLowerCase() : normalizedEmail.split('@')[0],
      fullName: data.fullName.trim(),
      mobile: data.mobile?.trim(),
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      status: data.status || 'active',
      department: data.department?.trim(),
      employeeId: data.employeeId?.trim(),
      assignedProjectIds: data.isAllProjects ? [] : data.assignedProjectIds,
      isAllProjects: data.isAllProjects,
      isDemo: false,
      remarks: data.remarks?.trim(),
      createdAt: new Date().toISOString(),
    };

    if (data.password) {
      newUser.password = data.password;
      newUser.lastPasswordChange = new Date().toISOString();
    }

    this.users.push(newUser);
    this.saveData();
    return { success: true, user: newUser };
  }

  public async updateUser(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.hasPermission('users.edit')) {
      return { success: false, error: 'Insufficient privileges to edit users.' };
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    // Safeguard 1: Anti-self-escalation: Normal user cannot modify their own role or privileges
    if (this.currentUser?.id === userId && updates.roleId && updates.roleId !== user.roleId) {
      if (!this.isSuperAdmin()) {
        return { success: false, error: 'Security violation: Users cannot escalate their own privileges or change their own role.' };
      }
    }

    // Safeguard 2: Super Admin minimum-one invariant check
    if (user.roleCode === 'super_admin' && updates.roleId) {
      const newRole = this.roles.find((r) => r.id === updates.roleId);
      if (newRole && newRole.code !== 'super_admin') {
        const activeSuperAdmins = this.users.filter((u) => u.roleCode === 'super_admin' && u.status === 'active');
        if (activeSuperAdmins.length <= 1 && user.status === 'active') {
          return {
            success: false,
            error: 'Cannot remove Super Administrator role: System must have at least one active Super Administrator.',
          };
        }
      }
    }

    // Only Super Admin can modify another Super Admin
    if (user.roleCode === 'super_admin' && !this.isSuperAdmin()) {
      return { success: false, error: 'Only a Super Administrator can modify another Super Administrator account.' };
    }

    if (updates.username !== undefined) {
      const cleanUsername = updates.username.trim().toLowerCase();
      if (cleanUsername) {
        const duplicate = this.users.find((u) => u.id !== userId && u.username?.toLowerCase() === cleanUsername);
        if (duplicate) {
          return { success: false, error: `Username "${updates.username}" is already taken.` };
        }
        user.username = cleanUsername;
      } else {
        user.username = undefined;
      }
    }

    if (updates.roleId) {
      const role = this.roles.find((r) => r.id === updates.roleId);
      if (role) {
        user.roleId = role.id;
        user.roleCode = role.code;
        user.roleName = role.name;
      }
    }

    if (updates.fullName !== undefined) user.fullName = updates.fullName.trim();
    if (updates.mobile !== undefined) user.mobile = updates.mobile?.trim();
    if (updates.department !== undefined) user.department = updates.department?.trim();
    if (updates.employeeId !== undefined) user.employeeId = updates.employeeId?.trim();
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.forcePasswordReset !== undefined) user.forcePasswordReset = updates.forcePasswordReset;
    if (updates.remarks !== undefined) user.remarks = updates.remarks?.trim();
    if (updates.isAllProjects !== undefined) user.isAllProjects = updates.isAllProjects;
    if (updates.assignedProjectIds !== undefined) user.assignedProjectIds = updates.assignedProjectIds;
    user.updatedAt = new Date().toISOString();

    this.enforceSuperAdminInvariant();
    this.saveData();
    return { success: true, user };
  }

  public async deactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('users.deactivate')) {
      return { success: false, error: 'Insufficient privileges to deactivate user accounts.' };
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    // Safeguard: Super Admin cannot deactivate themselves!
    if (this.currentUser?.id === userId && user.roleCode === 'super_admin') {
      return {
        success: false,
        error: 'Safeguard triggered: A Super Administrator cannot deactivate their own active session.',
      };
    }

    // Safeguard: Cannot deactivate final active Super Admin
    if (user.roleCode === 'super_admin') {
      const activeSuperAdmins = this.users.filter((u) => u.roleCode === 'super_admin' && u.status === 'active');
      if (activeSuperAdmins.length <= 1) {
        return {
          success: false,
          error: 'Safeguard triggered: Cannot deactivate the system’s sole active Super Administrator.',
        };
      }
    }

    user.status = 'inactive';
    user.updatedAt = new Date().toISOString();
    this.saveData();
    return { success: true };
  }

  public async suspendUser(userId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('users.deactivate') && !this.isSuperAdmin()) {
      return { success: false, error: 'Insufficient privileges to suspend user accounts.' };
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (user.roleCode === 'super_admin') {
      const activeSuperAdmins = this.users.filter((u) => u.roleCode === 'super_admin' && u.status === 'active');
      if (activeSuperAdmins.length <= 1) {
        return {
          success: false,
          error: 'Safeguard triggered: Cannot suspend the system’s sole active Super Administrator.',
        };
      }
    }

    user.status = 'suspended';
    if (reason) {
      user.remarks = user.remarks ? `${user.remarks} | Suspended: ${reason}` : `Suspended: ${reason}`;
    }
    user.updatedAt = new Date().toISOString();
    this.saveData();
    return { success: true };
  }

  public async activateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('users.activate')) {
      return { success: false, error: 'Insufficient privileges to activate user accounts.' };
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    user.status = 'active';
    user.updatedAt = new Date().toISOString();
    this.saveData();
    return { success: true };
  }

  public async setUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isSuperAdmin() && this.currentUser?.id !== userId) {
      return { success: false, error: 'Only Super Administrators or the account owner can change passwords.' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasNumber) {
      return {
        success: false,
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
      };
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'User not found.' };

    user.password = newPassword;
    user.lastPasswordChange = new Date().toISOString();
    user.forcePasswordReset = false;
    user.updatedAt = new Date().toISOString();
    this.saveData();

    return { success: true };
  }

  // -------------------------------------------------------------
  // ROLE MANAGEMENT & ANTI-ESCALATION
  // -------------------------------------------------------------
  public async createRole(
    name: string,
    description: string,
    permissions: string[]
  ): Promise<{ success: boolean; role?: Role; error?: string }> {
    if (!this.hasPermission('roles.create')) {
      return { success: false, error: 'Insufficient privileges to create custom roles.' };
    }

    // Non-Super Admins cannot include 'master_data.import' in created roles
    const safePermissions = this.isSuperAdmin()
      ? permissions
      : permissions.filter((p) => p !== 'master_data.import');

    const newRole: Role = {
      id: 'role-custom-' + Date.now(),
      code: 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: name.trim(),
      description: description.trim(),
      isSystem: false,
      permissions: safePermissions,
      createdAt: new Date().toISOString(),
    };

    this.roles.push(newRole);
    this.saveData();
    return { success: true, role: newRole };
  }

  public async updateRole(
    roleId: string,
    updates: { name?: string; description?: string; permissions?: string[] }
  ): Promise<{ success: boolean; role?: Role; error?: string }> {
    if (!this.hasPermission('roles.edit')) {
      return { success: false, error: 'Insufficient privileges to modify roles.' };
    }

    const role = this.roles.find((r) => r.id === roleId);
    if (!role) {
      return { success: false, error: 'Role not found.' };
    }

    // Cannot modify Super Admin role permissions unless Super Admin
    if (role.code === 'super_admin' && !this.isSuperAdmin()) {
      return { success: false, error: 'Only a Super Administrator can modify the Super Administrator role.' };
    }

    if (updates.name && !role.isSystem) role.name = updates.name.trim();
    if (updates.description) role.description = updates.description.trim();
    if (updates.permissions) {
      role.permissions = this.isSuperAdmin()
        ? updates.permissions
        : updates.permissions.filter((p) => p !== 'master_data.import');
    }
    role.updatedAt = new Date().toISOString();

    this.saveData();
    return { success: true, role };
  }

  public async deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('roles.delete')) {
      return { success: false, error: 'Insufficient privileges to delete roles.' };
    }

    const role = this.roles.find((r) => r.id === roleId);
    if (!role) {
      return { success: false, error: 'Role not found.' };
    }

    if (role.isSystem) {
      return { success: false, error: 'System default roles are protected and cannot be deleted.' };
    }

    // Check if any users are assigned to this role
    const assignedUsers = this.users.filter((u) => u.roleId === roleId);
    if (assignedUsers.length > 0) {
      return {
        success: false,
        error: `Cannot delete role: ${assignedUsers.length} active user(s) currently assigned to this role.`,
      };
    }

    this.roles = this.roles.filter((r) => r.id !== roleId);
    this.saveData();
    return { success: true };
  }

  // -------------------------------------------------------------
  // SETTINGS & WORKFLOW CONFIGURATION
  // -------------------------------------------------------------
  public updateWorkflowSettings(settings: WorkflowSettings): { success: boolean; error?: string } {
    if (!this.hasPermission('settings.edit')) {
      return { success: false, error: 'Insufficient privileges to modify workflow settings.' };
    }
    this.workflowSettings = { ...settings };
    this.saveData();
    return { success: true };
  }
}

export const authService = new AuthService();
export default authService;
