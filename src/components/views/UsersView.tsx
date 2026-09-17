import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Building,
  Mail,
  Phone,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Briefcase,
  X,
} from 'lucide-react';
import { UserProfile, Role, UserStatus } from '../../types/auth';
import { authService } from '../../services/authService';
import { accountingService } from '../../services/accountingService';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    roleId: '',
    department: '',
    employeeId: '',
    isAllProjects: true,
    assignedProjectIds: [] as string[],
    remarks: '',
  });

  const currentUser = authService.getCurrentUser();
  const allProjects = accountingService.getState().projects;

  const reloadData = () => {
    setUsers(authService.getUsers());
    setRoles(authService.getRoles());
  };

  useEffect(() => {
    reloadData();
    const unsub = authService.subscribe(reloadData);
    return () => unsub();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    const defaultRole = roles.find((r) => r.code === 'accountant') || roles[0];
    setFormData({
      fullName: '',
      email: '',
      mobile: '',
      roleId: defaultRole?.id || '',
      department: 'Accounting',
      employeeId: '',
      isAllProjects: true,
      assignedProjectIds: [],
      remarks: '',
    });
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile || '',
      roleId: user.roleId,
      department: user.department || '',
      employeeId: user.employeeId || '',
      isAllProjects: user.isAllProjects,
      assignedProjectIds: user.assignedProjectIds || [],
      remarks: user.remarks || '',
    });
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (editingUser) {
      // Update
      const res = await authService.updateUser(editingUser.id, {
        fullName: formData.fullName,
        mobile: formData.mobile,
        roleId: formData.roleId,
        department: formData.department,
        employeeId: formData.employeeId,
        isAllProjects: formData.isAllProjects,
        assignedProjectIds: formData.assignedProjectIds,
        remarks: formData.remarks,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `User ${formData.fullName} updated successfully.` });
        setIsModalOpen(false);
        reloadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update user.' });
      }
    } else {
      // Create
      const res = await authService.createUser({
        fullName: formData.fullName,
        email: formData.email,
        mobile: formData.mobile,
        roleId: formData.roleId,
        department: formData.department,
        employeeId: formData.employeeId,
        isAllProjects: formData.isAllProjects,
        assignedProjectIds: formData.assignedProjectIds,
        remarks: formData.remarks,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `New user ${formData.fullName} successfully registered.` });
        setIsModalOpen(false);
        reloadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create user.' });
      }
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    setFeedback(null);
    if (user.status === 'active') {
      const res = await authService.deactivateUser(user.id);
      if (res.success) {
        setFeedback({ type: 'success', message: `Account for ${user.fullName} has been deactivated.` });
        reloadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Cannot deactivate user.' });
      }
    } else {
      const res = await authService.activateUser(user.id);
      if (res.success) {
        setFeedback({ type: 'success', message: `Account for ${user.fullName} has been activated.` });
        reloadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Cannot activate user.' });
      }
    }
  };

  const handleProjectToggle = (projectId: string) => {
    if (formData.assignedProjectIds.includes(projectId)) {
      setFormData({
        ...formData,
        assignedProjectIds: formData.assignedProjectIds.filter((id) => id !== projectId),
      });
    } else {
      setFormData({
        ...formData,
        assignedProjectIds: [...formData.assignedProjectIds, projectId],
      });
    }
  };

  // Filter users: isolate demo users from real users; do not show demo users once signed in
  const filteredUsers = users.filter((u) => {
    if (u.isDemo && (!currentUser?.isDemo || u.id !== currentUser?.id)) return false;
    if (selectedRoleFilter !== 'ALL' && u.roleCode !== selectedRoleFilter) return false;
    if (selectedStatusFilter !== 'ALL' && u.status !== selectedStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roleName.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const canManageUsers = authService.hasPermission('users.create') || authService.isSuperAdmin();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>User Management &amp; Security Profiles</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure employee credentials, project-level scoping, and RBAC security authority.
          </p>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <div>
            <strong className="font-semibold block">{feedback.type === 'success' ? 'Operation Success' : 'Security Notice'}</strong>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, department..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedRoleFilter}
          onChange={(e) => setSelectedRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatusFilter}
          onChange={(e) => setSelectedStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>

        <div className="text-slate-500 dark:text-slate-400 text-right ml-auto">
          Total: <strong>{filteredUsers.length}</strong> user(s)
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">User &amp; Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department / Emp ID</th>
                <th className="px-4 py-3">Assigned Projects</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                const isSuperAdminRole = u.roleCode === 'super_admin';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{u.fullName}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px]">
                            You
                          </span>
                        )}
                        {isSuperAdminRole && (
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" title="Super Administrator" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {u.email}
                        </span>
                        {u.mobile && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {u.mobile}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {u.roleName}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900 dark:text-white">{u.department || 'Operations'}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {u.employeeId || 'EMP-N/A'}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {u.isAllProjects ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          All Projects Unrestricted
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-amber-700 dark:text-amber-400 font-semibold text-[11px] bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            {u.assignedProjectIds.length} Assigned Project(s)
                          </span>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {u.assignedProjectIds.join(', ')}
                          </p>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {u.status === 'active' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Inactive
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit User Profile & Role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrent && isSuperAdminRole}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                            u.status === 'active'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={
                            isCurrent && isSuperAdminRole
                              ? 'Safeguard: You cannot deactivate your own Super Administrator account.'
                              : u.status === 'active'
                              ? 'Deactivate User'
                              : 'Activate User'
                          }
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{editingUser ? 'Edit User Security Profile' : 'Register New Enterprise User'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="E.g., Salim Al Harthy"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Corporate Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingUser)}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="salim@construction.om"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="+968 9xxx xxxx"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="E.g., Site Operations, Finance"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="EMP-104"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Project-Level Scoping */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Project-Level Access Authorization
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.isAllProjects}
                      onChange={(e) => setFormData({ ...formData, isAllProjects: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Authorize All Projects</span>
                  </label>
                </div>

                {!formData.isAllProjects && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Select explicitly assigned construction projects:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                      {allProjects.map((p) => {
                        const isChecked = formData.assignedProjectIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] cursor-pointer ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 font-semibold text-blue-900 dark:text-blue-200'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleProjectToggle(p.id)}
                              className="rounded text-blue-600"
                            />
                            <span className="truncate">{p.code} - {p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Remarks
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Notes on role assignment, site authority, or reporting manager..."
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;
