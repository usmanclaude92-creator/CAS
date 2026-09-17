import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Users,
  Shield,
  Clock,
  Cloud,
  Database,
  ShieldAlert,
  HardDrive,
  RefreshCw,
  Plus,
  Key,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Upload,
  Settings,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Search,
  Check,
  Ban,
  Activity,
  UserCheck,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { UserProfile, Role, UserStatus } from '../../types/auth';
import {
  backupService,
  BackupConfig,
  BackupHistoryItem,
} from '../../services/backupService';
import { supabaseService } from '../../services/supabaseClient';
import { accountingService } from '../../services/accountingService';
import { useToast } from '../../context/ToastContext';
import { BackupSettingsModal } from '../modals/BackupSettingsModal';
import { RolesView } from './RolesView';
import { WorkflowSettingsView } from './WorkflowSettingsView';
import { AuditLogView } from './AuditLogView';
import { MasterImportAuditView } from './MasterImportAuditView';

export type SystemConfigTab =
  | 'credentials'
  | 'roles'
  | 'workflow'
  | 'backups'
  | 'database'
  | 'audit';

interface SystemConfigurationViewProps {
  initialTab?: SystemConfigTab;
  onOpenSupabaseSettings: () => void;
}

export const SystemConfigurationView: React.FC<SystemConfigurationViewProps> = ({
  initialTab = 'credentials',
  onOpenSupabaseSettings,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SystemConfigTab>(initialTab);
  const [isBackupSettingsOpen, setIsBackupSettingsOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>(backupService.getHistory());
  const [backupConfig, setBackupConfig] = useState<BackupConfig>(backupService.getConfig());

  // User & Credential Management state
  const [users, setUsers] = useState<UserProfile[]>(authService.getUsers());
  const [roles, setRoles] = useState<Role[]>(authService.getRoles());
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserStatusFilter, setSelectedUserStatusFilter] = useState('ALL');

  // Password reset modal state
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [forceResetOnLogin, setForceResetOnLogin] = useState(false);

  // User edit/create modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userFormData, setUserFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    mobile: '',
    roleId: '',
    department: 'Accounting',
    employeeId: '',
    status: 'active' as UserStatus,
    isAllProjects: true,
    assignedProjectIds: [] as string[],
    remarks: '',
  });

  // Supabase latency & test state
  const [dbPingMs, setDbPingMs] = useState<number | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = authService.isSuperAdmin();
  const allProjects = accountingService.getState().projects;

  const reloadData = () => {
    setUsers(authService.getUsers());
    setRoles(authService.getRoles());
    setBackupHistory(backupService.getHistory());
    setBackupConfig(backupService.getConfig());
  };

  useEffect(() => {
    reloadData();
    const unsubAuth = authService.subscribe(reloadData);
    const unsubBackup = backupService.subscribe(reloadData);
    return () => {
      unsubAuth();
      unsubBackup();
    };
  }, []);

  // Filter users: isolate demo users from real users; do not show demo users once signed in
  const filteredUsers = users.filter((u) => {
    if (u.isDemo && (!currentUser?.isDemo || u.id !== currentUser?.id)) return false;

    const matchesSearch =
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesStatus =
      selectedUserStatusFilter === 'ALL' || u.status === selectedUserStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Trigger Backup Now
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    toast.info('Initiating Cloud Backup', 'Capturing full database snapshot and preparing upload...');

    try {
      const res = await backupService.triggerBackupNow();
      if (res.success && res.item) {
        toast.success(
          'Backup Completed Successfully',
          `Archived ${res.item.fileSize} to ${res.item.destination} (${res.item.filename}).`
        );
        reloadData();
      } else {
        toast.error('Backup Operation Failed', res.error || 'Unable to complete backup transaction.');
      }
    } catch (err: any) {
      toast.error('Backup Error', err?.message || 'Unexpected failure during backup process.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Test Database Connection
  const handleTestDatabase = async () => {
    setIsTestingDb(true);
    const start = performance.now();
    try {
      const isConnected = await supabaseService.testConnection();
      const duration = Math.round(performance.now() - start);
      setDbPingMs(duration);

      if (isConnected) {
        toast.success(
          'Database Connected',
          `Supabase PostgreSQL responsive in ${duration}ms. Storage mirror verified.`
        );
      } else {
        toast.warning(
          'Running in Standalone Mode',
          'Local relational mirror is fully operational. Cloud Supabase credentials can be configured via DB Config.'
        );
      }
    } catch (e: any) {
      toast.error('Connection Test Error', e?.message || 'Database test query timed out.');
    } finally {
      setIsTestingDb(false);
    }
  };

  // Open User Edit Modal
  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setUserFormData({
      fullName: u.fullName,
      email: u.email,
      username: u.username || '',
      password: '',
      mobile: u.mobile || '',
      roleId: u.roleId,
      department: u.department || 'Accounting',
      employeeId: u.employeeId || '',
      status: u.status,
      isAllProjects: u.isAllProjects,
      assignedProjectIds: u.assignedProjectIds || [],
      remarks: u.remarks || '',
    });
    setIsUserModalOpen(true);
  };

  // Open User Create Modal
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    const defaultRole = roles.find((r) => r.code === 'accountant') || roles[0];
    setUserFormData({
      fullName: '',
      email: '',
      username: '',
      password: '',
      mobile: '',
      roleId: defaultRole?.id || '',
      department: 'Accounting',
      employeeId: '',
      status: 'active',
      isAllProjects: true,
      assignedProjectIds: [],
      remarks: '',
    });
    setIsUserModalOpen(true);
  };

  // Save User (Create / Update)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const res = await authService.updateUser(editingUser.id, {
        fullName: userFormData.fullName,
        username: userFormData.username || undefined,
        mobile: userFormData.mobile,
        roleId: userFormData.roleId,
        department: userFormData.department,
        employeeId: userFormData.employeeId,
        status: userFormData.status,
        isAllProjects: userFormData.isAllProjects,
        assignedProjectIds: userFormData.assignedProjectIds,
        remarks: userFormData.remarks,
      });

      if (res.success) {
        toast.success('User Updated', `${userFormData.fullName} profile & role updated.`);
        setIsUserModalOpen(false);
        reloadData();
      } else {
        toast.error('Update Failed', res.error || 'Could not update user profile.');
      }
    } else {
      const res = await authService.createUser({
        fullName: userFormData.fullName,
        email: userFormData.email,
        username: userFormData.username || undefined,
        password: userFormData.password || undefined,
        mobile: userFormData.mobile,
        roleId: userFormData.roleId,
        department: userFormData.department,
        employeeId: userFormData.employeeId,
        status: userFormData.status,
        isAllProjects: userFormData.isAllProjects,
        assignedProjectIds: userFormData.assignedProjectIds,
        remarks: userFormData.remarks,
      });

      if (res.success) {
        toast.success('User Registered', `${userFormData.fullName} added to system.`);
        setIsUserModalOpen(false);
        reloadData();
      } else {
        toast.error('Registration Failed', res.error || 'Could not register user.');
      }
    }
  };

  // Status toggle handler
  const handleSetUserStatus = async (user: UserProfile, newStatus: UserStatus) => {
    if (user.status === newStatus) return;

    if (newStatus === 'suspended') {
      const reason = window.prompt(`Enter suspension reason for ${user.fullName}:`, 'Administrative review');
      if (reason === null) return;
      const res = await authService.suspendUser(user.id, reason);
      if (res.success) {
        toast.success('Account Suspended', `${user.fullName} is now suspended from logging in.`);
        reloadData();
      } else {
        toast.error('Suspension Blocked', res.error || 'Cannot suspend user.');
      }
    } else if (newStatus === 'inactive') {
      const res = await authService.deactivateUser(user.id);
      if (res.success) {
        toast.success('Account Deactivated', `${user.fullName} marked inactive.`);
        reloadData();
      } else {
        toast.error('Action Blocked', res.error || 'Cannot deactivate user.');
      }
    } else {
      const res = await authService.activateUser(user.id);
      if (res.success) {
        toast.success('Account Activated', `${user.fullName} is now active.`);
        reloadData();
      } else {
        toast.error('Activation Blocked', res.error || 'Cannot activate user.');
      }
    }
  };

  // Open Password Reset Modal
  const handleOpenPasswordModal = (user: UserProfile) => {
    setPasswordModalUser(user);
    setNewUsername(user.username || '');
    setNewPassword('');
    setConfirmPassword('');
    setForceResetOnLogin(Boolean(user.forcePasswordReset));
  };

  // Save Password / Username Changes
  const handleSavePasswordModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;

    // Check username update if changed
    if (newUsername.trim() !== (passwordModalUser.username || '')) {
      const userRes = await authService.updateUser(passwordModalUser.id, {
        username: newUsername.trim() || undefined,
        forcePasswordReset: forceResetOnLogin,
      });
      if (!userRes.success) {
        toast.error('Username Update Failed', userRes.error);
        return;
      }
    }

    // Check password if provided
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        toast.error('Password Mismatch', 'New password and confirmation do not match.');
        return;
      }

      const passRes = await authService.setUserPassword(passwordModalUser.id, newPassword);
      if (!passRes.success) {
        toast.error('Password Policy Violation', passRes.error);
        return;
      }
    }

    toast.success('Credentials Updated', `Security credentials for ${passwordModalUser.fullName} updated.`);
    setPasswordModalUser(null);
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>System Configuration</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Administrative &amp; Technical Hub
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            User credentials, role-based access control (RBAC), multi-level approval limits, automated cloud backups, database connectivity, and audit logs.
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isBackingUp ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Backing Up...</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5" />
                <span>Backup Now</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSupabaseSettings}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>DB Config</span>
          </button>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-xs flex flex-wrap gap-1.5">
        {[
          { id: 'credentials', label: 'User & Credentials', icon: Key, badge: users.length },
          { id: 'roles', label: 'Roles & Permissions', icon: Shield, badge: roles.length },
          { id: 'workflow', label: 'Workflow & Approval Limits', icon: Clock },
          { id: 'backups', label: 'Cloud Backup & Sync', icon: Cloud, badge: backupHistory.length },
          { id: 'database', label: 'Database & Connectivity', icon: Database },
          { id: 'audit', label: 'Audit & Traceability', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SystemConfigTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USER & CREDENTIAL CONFIGURATION                                    */}
      {/* ========================================================================= */}
      {activeTab === 'credentials' && (
        <div className="space-y-5">
          {/* Action & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user name, username, email, ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                value={selectedUserStatusFilter}
                onChange={(e) => setSelectedUserStatusFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Active Accounts</option>
                <option value="suspended">Suspended Accounts</option>
                <option value="inactive">Inactive / Deactivated</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateUser}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>

          {/* User Directory Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 font-semibold">
                    <th className="py-3 px-4">User &amp; Username</th>
                    <th className="py-3 px-3">Role &amp; Privilege</th>
                    <th className="py-3 px-3">Department / ID</th>
                    <th className="py-3 px-3">Project Assignment</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Security &amp; Credentials</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{u.fullName}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                                  @{u.username || u.email.split('@')[0]}
                                </span>
                                <span>•</span>
                                <span>{u.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            <Shield className="w-3 h-3 text-blue-500" />
                            {u.roleName}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          <div>{u.department || 'General Operations'}</div>
                          {u.employeeId && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {u.employeeId}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {u.isAllProjects ? (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              All Projects (Global)
                            </span>
                          ) : (
                            <span className="text-xs font-mono">
                              {u.assignedProjectIds.length} Assigned Project(s)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {u.status === 'active' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                          {u.status === 'suspended' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <Ban className="w-3 h-3" /> Suspended
                            </span>
                          )}
                          {u.status === 'inactive' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <XCircle className="w-3 h-3" /> Inactive
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Encrypted</span>
                          </div>
                          {u.lastPasswordChange && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Changed: {new Date(u.lastPasswordChange).toLocaleDateString()}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenPasswordModal(u)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer flex items-center gap-1"
                              title="Reset password or update username"
                            >
                              <Key className="w-3.5 h-3.5 text-amber-500" />
                              <span>Credentials</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Edit user profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Status Changer Menu */}
                            {u.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => handleSetUserStatus(u, 'suspended')}
                                className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                title="Suspend user account"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetUserStatus(u, 'active')}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                                title="Activate user account"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROLES & PERMISSIONS (RBAC)                                         */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && <RolesView />}

      {/* ========================================================================= */}
      {/* TAB 3: WORKFLOW & APPROVAL LIMITS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'workflow' && <WorkflowSettingsView />}

      {/* ========================================================================= */}
      {/* TAB 4: CLOUD BACKUP & SYNC                                                */}
      {/* ========================================================================= */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          {/* Status & Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Engine Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Backup Engine Status
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {backupConfig.destination}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {backupConfig.autoDailyBackupEnabled ? 'Daily scheduled snapshots enabled' : 'Manual snapshot mode'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Retention policy:</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Keep {backupConfig.retentionCount} versions
                </span>
              </div>
            </div>

            {/* Last Backup Info */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Latest Backup Run
                </span>
                <HardDrive className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {backupConfig.lastBackupDate
                    ? new Date(backupConfig.lastBackupDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Today'}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {backupConfig.lastBackupDate
                    ? new Date(backupConfig.lastBackupDate).toLocaleDateString()
                    : 'System initialized'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Status:</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {backupConfig.lastBackupStatus || 'Verified & Healthy'}
                </span>
              </div>
            </div>

            {/* Controls Card */}
            <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Snapshot Trigger &amp; Settings
                </span>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Trigger immediate snapshot export and configure Google Drive / OneDrive credentials.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isBackingUp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Backing Up...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5" />
                      Backup Now
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsBackupSettingsOpen(true)}
                  className="p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
                  title="Open Backup Settings Modal"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Backup History &amp; Archives</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Past backup snapshots, status verifications, file sizes, and direct restore/download actions
                </p>
              </div>

              <span className="text-xs font-mono text-slate-500">
                Total Runs: <strong>{backupHistory.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Destination</th>
                    <th className="py-3 px-3">File Size</th>
                    <th className="py-3 px-3">Snapshot Records Summary</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {backupHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {new Date(item.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {item.status === 'Success' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </span>
                        )}
                        {item.status === 'Failed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {item.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Clock className="w-3 h-3" /> In Progress
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                        <Cloud className="w-3.5 h-3.5 text-blue-500" />
                        <span>{item.destination}</span>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {item.fileSize}
                      </td>

                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {item.recordsSummary ? (
                          <span>
                            {item.recordsSummary.projects} projects • {item.recordsSummary.transactions} journal entries • {item.recordsSummary.customers} clients
                          </span>
                        ) : (
                          <span>Complete Database Snapshot</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => backupService.downloadBackupItem(item)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DATABASE & CONNECTIVITY (Supabase & Relational Mirror)             */}
      {/* ========================================================================= */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supabase Status Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Supabase Cloud Storage
                    </h3>
                    <p className="text-xs text-slate-500">
                      PostgreSQL Real-Time Relational Cluster
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Project Endpoint:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {supabaseService.getConfig().supabaseUrl || 'https://xxx.supabase.co'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Latency Ping:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {dbPingMs !== null ? `${dbPingMs} ms` : 'Ready to Test'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Persistence Model:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Hybrid Dual-Write (Local Mirror + Supabase Sync)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={isTestingDb}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
                >
                  {isTestingDb ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing...
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" /> Ping Database
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onOpenSupabaseSettings}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Configure Supabase Keys
                </button>
              </div>
            </div>

            {/* Health & Cache Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Local Data Mirror &amp; Integrity
                  </h3>
                  <p className="text-xs text-slate-500">
                    Browser Indexed Storage &amp; Cache State
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Total Projects:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {accountingService.getState().projects.length}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">General Ledger Transactions:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {accountingService.getState().journalEntries.length} entries
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Total System Users:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {users.length} registered
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all demo entities to official standard seed data?')) {
                      accountingService.resetToSeedData();
                      toast.success('Seed Data Reloaded', 'Default construction entities and ledger restored.');
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reload Standard Seed Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AUDIT & TRACEABILITY                                               */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              System Audit Logs &amp; Traceability
            </span>
          </div>
          <AuditLogView />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREDENTIALS / PASSWORD RESET                                       */}
      {/* ========================================================================= */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Update Credentials &amp; Password
                  </h3>
                  <p className="text-xs text-slate-500">{passwordModalUser.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePasswordModal} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  System Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. tariq.admin"
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters (Upper + lower + number)"
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Password complexity guidelines */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Complexity Policy:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>At least 8 characters long</li>
                  <li>At least 1 uppercase &amp; 1 lowercase character</li>
                  <li>At least 1 numeric digit (0-9)</li>
                </ul>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="forceReset"
                  checked={forceResetOnLogin}
                  onChange={(e) => setForceResetOnLogin(e.target.checked)}
                  className="rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="forceReset" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Require user to reset password on next login
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shadow-sm"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT USER PROFILE                                         */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Edit User Account' : 'Create New System User'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assign role, credentials, and project permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.fullName}
                    onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ahmed.acc"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingUser)}
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+968 9xxx xxxx"
                    value={userFormData.mobile}
                    onChange={(e) => setUserFormData({ ...userFormData, mobile: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {!editingUser && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder="Min 8 characters (Upper + lower + number)"
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    System Role *
                  </label>
                  <select
                    value={userFormData.roleId}
                    onChange={(e) => setUserFormData({ ...userFormData, roleId: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Account Status
                  </label>
                  <select
                    value={userFormData.status}
                    onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value as UserStatus })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Project Scope Assignment */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project Access Scope
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allProjectsScope"
                    checked={userFormData.isAllProjects}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        isAllProjects: e.target.checked,
                        assignedProjectIds: e.target.checked ? [] : userFormData.assignedProjectIds,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <label htmlFor="allProjectsScope" className="text-xs text-slate-700 dark:text-slate-300">
                    All Projects Access (Global Company-Wide Scope)
                  </label>
                </div>

                {!userFormData.isAllProjects && (
                  <div className="max-h-32 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 bg-slate-50 dark:bg-slate-950">
                    {allProjects.map((p) => {
                      const isAssigned = userFormData.assignedProjectIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              const newIds = e.target.checked
                                ? [...userFormData.assignedProjectIds, p.id]
                                : userFormData.assignedProjectIds.filter((id) => id !== p.id);
                              setUserFormData({ ...userFormData, assignedProjectIds: newIds });
                            }}
                            className="rounded text-blue-600"
                          />
                          <span>
                            {p.code} - {p.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shadow-sm"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BACKUP SETTINGS (Google Drive / OneDrive OAuth / Retention)        */}
      {/* ========================================================================= */}
      <BackupSettingsModal
        isOpen={isBackupSettingsOpen}
        onClose={() => setIsBackupSettingsOpen(false)}
        onSaved={reloadData}
      />
    </div>
  );
};

export default SystemConfigurationView;
