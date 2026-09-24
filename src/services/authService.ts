import type { Session } from '@supabase/supabase-js';
import {
  UserProfile,
  Role,
  Permission,
  SystemRole,
  UserStatus,
  WorkflowSettings,
  MasterImportAuditRecord,
} from '../types/auth';
import { ALL_PERMISSIONS } from './permissionsData';
import { getSupabaseClient } from './supabaseClient';

// -------------------------------------------------------------
// Row <-> app-model mapping (DB is the single source of truth;
// no localStorage cache, no plaintext passwords, no client-embedded
// demo user list. Passwords live exclusively in Supabase Auth.)
// -------------------------------------------------------------
function mapProfileRow(row: any, projectIds: string[]): UserProfile {
  return {
    id: row.id,
    email: row.email,
    username: row.username ?? undefined,
    fullName: row.full_name,
    mobile: row.mobile ?? undefined,
    roleId: row.role_code,
    roleCode: row.role_code,
    roleName: row.role_name ?? row.role_code,
    status: row.status,
    isDemo: Boolean(row.is_demo),
    forcePasswordReset: Boolean(row.force_password_reset),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    department: row.department ?? undefined,
    employeeId: row.employee_id ?? undefined,
    assignedProjectIds: projectIds,
    isAllProjects: Boolean(row.is_all_projects),
    remarks: row.remarks ?? undefined,
    lastLogin: row.last_login ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapRoleRow(row: any): Role {
  return {
    id: row.code,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    isSystem: Boolean(row.is_system),
    permissions: row.permissions ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

const DEFAULT_WORKFLOW_SETTINGS_FALLBACK: WorkflowSettings = {
  separationOfDutiesEnabled: true,
  requireApprovalAboveOMR: 0,
  approvalLimits: [],
};

class AuthService {
  private currentUser: UserProfile | null = null;
  private roles: Role[] = [];
  private users: UserProfile[] = [];
  private workflowSettings: WorkflowSettings = DEFAULT_WORKFLOW_SETTINGS_FALLBACK;
  private masterImportAudits: MasterImportAuditRecord[] = [];
  private listeners: Array<() => void> = [];
  private ready = false;
  private lastAuthError: string | null = null;
  // True as soon as a Supabase session (valid JWT) is known to exist —
  // well before the profile/roles chain below resolves. Row Level Security
  // (is_active_user(), has_permission()) is enforced entirely server-side
  // from auth.uid(), so dependent services (accountingService) can safely
  // start fetching data on this signal instead of waiting for `ready`.
  private hasSession = false;

  constructor() {
    this.bootstrap();
  }

  private async bootstrap() {
    const client = getSupabaseClient();
    if (!client) {
      this.lastAuthError =
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — this application stores all data in Supabase and has no offline/local fallback.';
      console.error('[AuthService]', this.lastAuthError);
      this.ready = true;
      this.notify();
      return;
    }

    client.auth.onAuthStateChange((_event, session) => {
      this.hasSession = Boolean(session?.user);
      this.handleSession(session);
    });

    const { data } = await client.auth.getSession();
    this.hasSession = Boolean(data.session?.user);
    // Notify immediately once session presence is known, so dependent
    // services can start fetching in parallel with the profile/roles
    // lookups below rather than waiting for the full chain to finish.
    this.notify();

    await this.handleSession(data.session);
    this.ready = true;
    this.notify();
  }

  private async handleSession(session: Session | null) {
    const client = getSupabaseClient();
    if (!client || !session?.user) {
      this.currentUser = null;
      this.notify();
      return;
    }

    // Independent of each other (both keyed only off session.user.id) —
    // fetch in parallel instead of one after another.
    const [{ data: profileRow, error }, { data: assignments }] = await Promise.all([
      client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      client.from('user_project_assignments').select('project_id').eq('user_id', session.user.id),
    ]);

    if (error || !profileRow) {
      console.error('[AuthService] Failed to load profile for authenticated session:', error);
      this.currentUser = null;
      this.notify();
      return;
    }

    this.currentUser = mapProfileRow(profileRow, (assignments ?? []).map((a: any) => a.project_id));

    await Promise.all([this.loadRolesAndSettings(), this.maybeLoadUsersList()]);
    this.notify();
  }

  private async loadRolesAndSettings() {
    const client = getSupabaseClient();
    if (!client) return;

    const [{ data: roleRows }, { data: settingsRow }, { data: limitRows }] = await Promise.all([
      client.from('roles').select('*'),
      client.from('workflow_settings').select('*').eq('id', true).maybeSingle(),
      client.from('approval_limits').select('*'),
    ]);

    this.roles = (roleRows ?? []).map(mapRoleRow);

    if (settingsRow) {
      this.workflowSettings = {
        separationOfDutiesEnabled: Boolean(settingsRow.separation_of_duties_enabled),
        requireApprovalAboveOMR: Number(settingsRow.require_approval_above_omr) || 0,
        approvalLimits: (limitRows ?? []).map((l: any) => ({
          roleCode: l.role_code,
          roleName: this.roles.find((r) => r.code === l.role_code)?.name ?? l.role_code,
          maxAmountOMR: Number(l.max_amount_omr) || 0,
        })),
      };
    }
  }

  private async maybeLoadUsersList() {
    if (!this.hasPermission('users.view')) {
      this.users = this.currentUser ? [this.currentUser] : [];
      return;
    }
    const client = getSupabaseClient();
    if (!client) return;

    const [{ data: profileRows }, { data: allAssignments }] = await Promise.all([
      client.from('profiles').select('*').order('created_at', { ascending: true }),
      client.from('user_project_assignments').select('user_id, project_id'),
    ]);

    const assignmentsByUser = new Map<string, string[]>();
    (allAssignments ?? []).forEach((a: any) => {
      const list = assignmentsByUser.get(a.user_id) ?? [];
      list.push(a.project_id);
      assignmentsByUser.set(a.user_id, list);
    });

    this.users = (profileRows ?? []).map((row: any) => mapProfileRow(row, assignmentsByUser.get(row.id) ?? []));
  }

  private async adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const client = getSupabaseClient();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) throw new Error('No active session.');
    // Admin endpoints (user creation, password reset for others, demo-request
    // approval) run on the CAS web app's Express server, which holds the
    // service_role key. A client with no server of its own (e.g. the Android
    // build) points this at that deployment via VITE_ADMIN_API_URL.
    const base = ((import.meta as any).env?.VITE_ADMIN_API_URL || '').replace(/\/+$/, '');
    return fetch(`${base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
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

  public isReady(): boolean {
    return this.ready;
  }

  public hasActiveSession(): boolean {
    return this.hasSession;
  }

  public getLastAuthError(): string | null {
    return this.lastAuthError;
  }

  // -------------------------------------------------------------
  // AUTHENTICATION FLOWS
  // -------------------------------------------------------------
  public async login(
    email: string,
    password: string,
    _rememberMe = true // Supabase session persistence is always enabled; kept for call-site compatibility
  ): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase is not configured. Contact your administrator.' };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Invalid credentials.' };
    }

    await this.handleSession(data.session);

    if (!this.currentUser) {
      await client.auth.signOut();
      return { success: false, error: 'No profile found for this account. Contact your administrator.' };
    }

    if (this.currentUser.status !== 'active') {
      await client.auth.signOut();
      this.currentUser = null;
      this.notify();
      return { success: false, error: 'Account is deactivated. Please contact your system administrator.' };
    }

    await client.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', this.currentUser.id);

    return { success: true, user: this.currentUser };
  }

  public async logout(): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('[AuthService] signOut error:', e);
      }
    }
    this.hasSession = false;
    this.currentUser = null;
    this.users = [];
    this.notify();
  }

  public async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Supabase is not configured.' };
    }
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: `Password reset email dispatched to ${email.trim().toLowerCase()}.` };
  }

  // -------------------------------------------------------------
  // USER PROFILE & AUTHORIZATION GETTERS (synchronous, cache-backed)
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

  public getDemoUsers(): UserProfile[] {
    return this.users.filter((u) => u.isDemo === true);
  }

  public getRealUsers(): UserProfile[] {
    return this.users.filter((u) => !u.isDemo);
  }

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
    if (this.currentUser.roleCode === 'super_admin') return true;

    const role = this.roles.find((r) => r.code === this.currentUser?.roleCode);
    if (!role) return false;

    return role.permissions.includes(permissionCode);
  }

  public hasProjectAccess(projectId?: string | null): boolean {
    return this.canAccessProject(projectId);
  }

  // -------------------------------------------------------------
  // MASTER DATA IMPORT SECURITY (defense-in-depth; DB RLS is authoritative)
  // -------------------------------------------------------------
  public verifyMasterDataImportAuthority(): { allowed: boolean; status: number; error?: string } {
    if (!this.currentUser) {
      return { allowed: false, status: 401, error: '401 Unauthorized: User session not established.' };
    }
    if (this.currentUser.status !== 'active') {
      return { allowed: false, status: 403, error: '403 Forbidden: User account is inactive.' };
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

  // -------------------------------------------------------------
  // HISTORICAL MONEY IN IMPORT SECURITY (defense-in-depth; DB RLS/RPC is authoritative)
  // -------------------------------------------------------------
  public verifyMoneyInImportAuthority(): { allowed: boolean; status: number; error?: string } {
    if (!this.currentUser) {
      return { allowed: false, status: 401, error: '401 Unauthorized: User session not established.' };
    }
    if (this.currentUser.status !== 'active') {
      return { allowed: false, status: 403, error: '403 Forbidden: User account is inactive.' };
    }
    if (!this.hasPermission('money_in.import')) {
      return {
        allowed: false,
        status: 403,
        error: '403 Forbidden: Missing required privilege "money_in.import".',
      };
    }
    return { allowed: true, status: 200 };
  }

  // -------------------------------------------------------------
  // HISTORICAL CLIENT INVOICE IMPORT SECURITY (defense-in-depth; DB RLS/RPC is authoritative)
  // -------------------------------------------------------------
  public verifyClientInvoiceImportAuthority(): { allowed: boolean; status: number; error?: string } {
    if (!this.currentUser) {
      return { allowed: false, status: 401, error: '401 Unauthorized: User session not established.' };
    }
    if (this.currentUser.status !== 'active') {
      return { allowed: false, status: 403, error: '403 Forbidden: User account is inactive.' };
    }
    if (!this.hasPermission('invoices.import')) {
      return {
        allowed: false,
        status: 403,
        error: '403 Forbidden: Missing required privilege "invoices.import".',
      };
    }
    return { allowed: true, status: 200 };
  }

  public async recordMasterDataImportAudit(record: Omit<MasterImportAuditRecord, 'id' | 'timestamp'>) {
    const client = getSupabaseClient();
    const entry: MasterImportAuditRecord = {
      ...record,
      id: 'import-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    };
    this.masterImportAudits.unshift(entry);
    if (client) {
      await client.from('master_import_audit').insert({
        import_type: record.importType,
        file_name: record.fileName,
        imported_by_user_id: record.importedByUserId,
        imported_by_user_name: record.importedByUserName,
        imported_by_user_email: record.importedByUserEmail,
        total_rows: record.totalRows,
        new_records: record.newRecords,
        existing_records: record.existingRecords,
        duplicate_records: record.duplicateRecords,
        invalid_records: record.invalidRecords,
        skipped_records: record.skippedRecords,
        result: record.result,
        error_details: record.errorDetails ?? null,
      });
    }
    this.notify();
    return entry;
  }

  public getMasterImportAudits(): MasterImportAuditRecord[] {
    return [...this.masterImportAudits];
  }

  // -------------------------------------------------------------
  // PROJECT-LEVEL AUTHORIZATION (client-side mirror of RLS can_access_project)
  // -------------------------------------------------------------
  public canAccessProject(projectId?: string | null): boolean {
    if (!this.currentUser || this.currentUser.status !== 'active') return false;
    if (!projectId) return true;
    if (this.currentUser.roleCode === 'super_admin') return true;
    if (this.currentUser.isAllProjects) return true;
    return this.currentUser.assignedProjectIds.includes(projectId);
  }

  public filterAccessibleProjects<T extends { id: string }>(projects: T[]): T[] {
    if (!this.currentUser || this.currentUser.status !== 'active') return [];
    if (this.currentUser.roleCode === 'super_admin' || this.currentUser.isAllProjects) return projects;
    return projects.filter((p) => this.currentUser!.assignedProjectIds.includes(p.id));
  }

  public filterAccessibleTransactions<T extends { projectId?: string }>(transactions: T[]): T[] {
    if (!this.currentUser || this.currentUser.status !== 'active') return [];
    if (this.currentUser.roleCode === 'super_admin' || this.currentUser.isAllProjects) return transactions;
    return transactions.filter((t) => !t.projectId || this.currentUser!.assignedProjectIds.includes(t.projectId));
  }

  // -------------------------------------------------------------
  // APPROVAL WORKFLOW (client-side mirror; the transition_transaction()
  // Postgres RPC in accountingService is the authoritative enforcement)
  // -------------------------------------------------------------
  public canApproveTransaction(
    amount: number,
    creatorUserId?: string,
    permissionCode = 'approvals.approve'
  ): { allowed: boolean; reason?: string } {
    if (!this.currentUser || this.currentUser.status !== 'active') {
      return { allowed: false, reason: 'User session is inactive or not logged in.' };
    }
    if (!this.hasPermission(permissionCode) && !this.hasPermission('approvals.approve')) {
      return { allowed: false, reason: `Missing required approval permission (${permissionCode}).` };
    }
    if (this.workflowSettings.separationOfDutiesEnabled && creatorUserId && creatorUserId === this.currentUser.id) {
      return {
        allowed: false,
        reason: 'Separation of Duties (SOD) violation: Transaction creator cannot approve their own transaction.',
      };
    }
    const roleLimit = this.workflowSettings.approvalLimits.find((l) => l.roleCode === this.currentUser?.roleCode);
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
  // USER MANAGEMENT (creates real Supabase Auth accounts via server
  // admin endpoint — the service_role key never reaches the browser)
  // -------------------------------------------------------------
  public async createUser(data: {
    fullName: string;
    email: string;
    username?: string;
    password?: string;
    mobile?: string;
    roleId: string; // role code
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
    if (!data.password || data.password.length < 8) {
      return { success: false, error: 'A password of at least 8 characters is required to provision a new account.' };
    }

    try {
      const res = await this.adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          fullName: data.fullName.trim(),
          username: data.username?.trim().toLowerCase(),
          mobile: data.mobile?.trim(),
          roleCode: data.roleId,
          assignedProjectIds: data.isAllProjects ? [] : data.assignedProjectIds,
          isAllProjects: data.isAllProjects,
          department: data.department?.trim(),
          employeeId: data.employeeId?.trim(),
          status: data.status || 'active',
          remarks: data.remarks?.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        return { success: false, error: body.error || 'Failed to create user.' };
      }
      await this.maybeLoadUsersList();
      this.notify();
      return { success: true, user: body.user };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error while creating user.' };
    }
  }

  public async updateUser(userId: string, updates: Partial<UserProfile>): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.hasPermission('users.edit')) {
      return { success: false, error: 'Insufficient privileges to edit users.' };
    }
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const target = this.users.find((u) => u.id === userId);
    if (!target) return { success: false, error: 'User not found.' };

    if (this.currentUser?.id === userId && updates.roleId && updates.roleId !== target.roleId && !this.isSuperAdmin()) {
      return { success: false, error: 'Security violation: Users cannot escalate their own privileges or change their own role.' };
    }
    if (target.roleCode === 'super_admin' && !this.isSuperAdmin()) {
      return { success: false, error: 'Only a Super Administrator can modify another Super Administrator account.' };
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.username !== undefined) patch.username = updates.username?.trim().toLowerCase() || null;
    if (updates.fullName !== undefined) patch.full_name = updates.fullName.trim();
    if (updates.mobile !== undefined) patch.mobile = updates.mobile?.trim() || null;
    if (updates.department !== undefined) patch.department = updates.department?.trim() || null;
    if (updates.employeeId !== undefined) patch.employee_id = updates.employeeId?.trim() || null;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.forcePasswordReset !== undefined) patch.force_password_reset = updates.forcePasswordReset;
    if (updates.remarks !== undefined) patch.remarks = updates.remarks?.trim() || null;
    if (updates.isAllProjects !== undefined) patch.is_all_projects = updates.isAllProjects;
    if (updates.roleId) {
      const role = this.roles.find((r) => r.code === updates.roleId);
      if (role) patch.role_code = role.code;
    }

    const { error } = await client.from('profiles').update(patch).eq('id', userId);
    if (error) return { success: false, error: error.message };

    if (updates.assignedProjectIds !== undefined) {
      await client.from('user_project_assignments').delete().eq('user_id', userId);
      if (!updates.isAllProjects && updates.assignedProjectIds.length) {
        await client.from('user_project_assignments').insert(
          updates.assignedProjectIds.map((pid) => ({ user_id: userId, project_id: pid }))
        );
      }
    }

    await this.maybeLoadUsersList();
    if (this.currentUser?.id === userId) await this.handleSession((await client.auth.getSession()).data.session);
    this.notify();
    return { success: true, user: this.users.find((u) => u.id === userId) };
  }

  public async deactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('users.deactivate')) {
      return { success: false, error: 'Insufficient privileges to deactivate user accounts.' };
    }
    if (this.currentUser?.id === userId) {
      return { success: false, error: 'Safeguard triggered: You cannot deactivate your own active session.' };
    }
    return this.setUserStatus(userId, 'inactive');
  }

  public async suspendUser(userId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('users.deactivate') && !this.isSuperAdmin()) {
      return { success: false, error: 'Insufficient privileges to suspend user accounts.' };
    }
    return this.setUserStatus(userId, 'suspended', reason);
  }

  public async activateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('users.activate')) {
      return { success: false, error: 'Insufficient privileges to activate user accounts.' };
    }
    return this.setUserStatus(userId, 'active');
  }

  private async setUserStatus(userId: string, status: UserStatus, reason?: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const target = this.users.find((u) => u.id === userId);
    if (!target) return { success: false, error: 'User not found.' };

    if (target.roleCode === 'super_admin' && status !== 'active') {
      const activeSuperAdmins = this.users.filter((u) => u.roleCode === 'super_admin' && u.status === 'active');
      if (activeSuperAdmins.length <= 1) {
        return { success: false, error: `Safeguard triggered: Cannot ${status} the system's sole active Super Administrator.` };
      }
    }

    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (reason) patch.remarks = target.remarks ? `${target.remarks} | ${status}: ${reason}` : `${status}: ${reason}`;

    const { error } = await client.from('profiles').update(patch).eq('id', userId);
    if (error) return { success: false, error: error.message };

    await this.maybeLoadUsersList();
    this.notify();
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
      return { success: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    if (this.currentUser?.id === userId) {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      await client.from('profiles').update({ force_password_reset: false, updated_at: new Date().toISOString() }).eq('id', userId);
      return { success: true };
    }

    try {
      const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/set-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) return { success: false, error: body.error || 'Failed to set password.' };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error while setting password.' };
    }
  }

  // -------------------------------------------------------------
  // ROLE MANAGEMENT (DB-backed; RLS enforces roles.create/roles.edit)
  // -------------------------------------------------------------
  public async createRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; role?: Role; error?: string }> {
    if (!this.hasPermission('roles.create')) {
      return { success: false, error: 'Insufficient privileges to create custom roles.' };
    }
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const safePermissions = this.isSuperAdmin() ? permissions : permissions.filter((p) => p !== 'master_data.import');
    const code = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);

    const { data, error } = await client
      .from('roles')
      .insert({ code, name: name.trim(), description: description.trim(), is_system: false, permissions: safePermissions })
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    await this.loadRolesAndSettings();
    this.notify();
    return { success: true, role: mapRoleRow(data) };
  }

  public async updateRole(
    roleId: string,
    updates: { name?: string; description?: string; permissions?: string[] }
  ): Promise<{ success: boolean; role?: Role; error?: string }> {
    if (!this.hasPermission('roles.edit')) {
      return { success: false, error: 'Insufficient privileges to modify roles.' };
    }
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const role = this.roles.find((r) => r.id === roleId);
    if (!role) return { success: false, error: 'Role not found.' };
    if (role.code === 'super_admin' && !this.isSuperAdmin()) {
      return { success: false, error: 'Only a Super Administrator can modify the Super Administrator role.' };
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name && !role.isSystem) patch.name = updates.name.trim();
    if (updates.description) patch.description = updates.description.trim();
    if (updates.permissions) {
      patch.permissions = this.isSuperAdmin() ? updates.permissions : updates.permissions.filter((p) => p !== 'master_data.import');
    }

    const { error } = await client.from('roles').update(patch).eq('code', role.code);
    if (error) return { success: false, error: error.message };

    await this.loadRolesAndSettings();
    this.notify();
    return { success: true, role: this.roles.find((r) => r.code === role.code) };
  }

  public async deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('roles.delete')) {
      return { success: false, error: 'Insufficient privileges to delete roles.' };
    }
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const role = this.roles.find((r) => r.id === roleId);
    if (!role) return { success: false, error: 'Role not found.' };
    if (role.isSystem) return { success: false, error: 'System default roles are protected and cannot be deleted.' };

    const assignedUsers = this.users.filter((u) => u.roleId === roleId);
    if (assignedUsers.length > 0) {
      return { success: false, error: `Cannot delete role: ${assignedUsers.length} active user(s) currently assigned to this role.` };
    }

    const { error } = await client.from('roles').delete().eq('code', role.code);
    if (error) return { success: false, error: error.message };

    await this.loadRolesAndSettings();
    this.notify();
    return { success: true };
  }

  // -------------------------------------------------------------
  // WORKFLOW SETTINGS (DB-backed; RLS enforces settings.edit)
  // -------------------------------------------------------------
  public async updateWorkflowSettings(settings: WorkflowSettings): Promise<{ success: boolean; error?: string }> {
    if (!this.hasPermission('settings.edit')) {
      return { success: false, error: 'Insufficient privileges to modify workflow settings.' };
    }
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const { error: settingsError } = await client
      .from('workflow_settings')
      .update({
        separation_of_duties_enabled: settings.separationOfDutiesEnabled,
        require_approval_above_omr: settings.requireApprovalAboveOMR,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);
    if (settingsError) return { success: false, error: settingsError.message };

    for (const limit of settings.approvalLimits) {
      await client.from('approval_limits').upsert(
        { role_code: limit.roleCode, max_amount_omr: limit.maxAmountOMR },
        { onConflict: 'role_code' }
      );
    }

    this.workflowSettings = { ...settings };
    this.notify();
    return { success: true };
  }
}

export const authService = new AuthService();
export default authService;
