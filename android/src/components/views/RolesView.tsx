import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Info,
  X,
} from 'lucide-react';
import { Role } from '../../types/auth';
import { authService } from '../../services/authService';
import { PERMISSION_MODULES } from '../../services/permissionsData';

export const RolesView: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPermissions, setEditedPermissions] = useState<string[]>([]);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Custom Role Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);

  const isSuperAdmin = authService.isSuperAdmin();

  const loadRoles = () => {
    const list = authService.getRoles();
    setRoles(list);
    if (!selectedRole && list.length > 0) {
      setSelectedRole(list[0]);
      setEditedPermissions(list[0].permissions);
      setRoleName(list[0].name);
      setRoleDesc(list[0].description);
    } else if (selectedRole) {
      const refreshed = list.find((r) => r.id === selectedRole.id);
      if (refreshed) {
        setSelectedRole(refreshed);
        setEditedPermissions(refreshed.permissions);
        setRoleName(refreshed.name);
        setRoleDesc(refreshed.description);
      }
    }
  };

  useEffect(() => {
    loadRoles();
    const unsub = authService.subscribe(loadRoles);
    return () => unsub();
  }, []);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setIsEditing(false);
    setEditedPermissions(role.permissions);
    setRoleName(role.name);
    setRoleDesc(role.description);
    setFeedback(null);
  };

  const handleTogglePermission = (code: string) => {
    if (!isEditing) return;

    // Prevent non-super-admin from adding master_data.import
    if (code === 'master_data.import' && !isSuperAdmin) {
      setFeedback({
        type: 'error',
        message: 'Security rule: Only Super Administrator can grant master data import authority.',
      });
      return;
    }

    if (editedPermissions.includes(code)) {
      setEditedPermissions(editedPermissions.filter((p) => p !== code));
    } else {
      setEditedPermissions([...editedPermissions, code]);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setFeedback(null);

    const res = await authService.updateRole(selectedRole.id, {
      name: roleName,
      description: roleDesc,
      permissions: editedPermissions,
    });

    if (res.success) {
      setFeedback({ type: 'success', message: `Role "${roleName}" permissions updated successfully.` });
      setIsEditing(false);
      loadRoles();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update role permissions.' });
    }
  };

  const handleDeleteRole = async (role: Role) => {
    setFeedback(null);
    if (role.isSystem) {
      setFeedback({ type: 'error', message: 'System standard roles are protected and cannot be removed.' });
      return;
    }

    const res = await authService.deleteRole(role.id);
    if (res.success) {
      setFeedback({ type: 'success', message: `Custom role "${role.name}" deleted.` });
      loadRoles();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Cannot delete role.' });
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const res = await authService.createRole(newRoleName, newRoleDesc, newRolePermissions);
    if (res.success) {
      setFeedback({ type: 'success', message: `Custom role "${newRoleName}" created.` });
      setIsCreateModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRolePermissions([]);
      loadRoles();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to create role.' });
    }
  };

  const canEditRoles = authService.hasPermission('roles.edit') || isSuperAdmin;
  const canCreateRoles = authService.hasPermission('roles.create') || isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Role-Based Access Control (RBAC) &amp; Permissions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Define system authorization scopes, module privileges, and master-data access safeguards.
          </p>
        </div>

        {canCreateRoles && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Role</span>
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
            <strong className="font-semibold block">
              {feedback.type === 'success' ? 'Settings Applied' : 'Privilege Restriction'}
            </strong>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Main Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Roles List */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              System &amp; Custom Roles
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {roles.length} Roles Defined
            </span>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {roles.map((role) => {
              const isSelected = selectedRole?.id === role.id;
              const isSuper = role.code === 'super_admin';

              return (
                <div
                  key={role.id}
                  onClick={() => handleSelectRole(role)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {role.name}
                      {isSuper && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
                    </span>
                    {role.isSystem ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Standard
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {role.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span>{role.permissions.length} Permissions</span>
                    <span className="font-mono">{role.code}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Matrix */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
          {selectedRole ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedRole.name}
                    </h3>
                    {selectedRole.isSystem && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        System Protected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedRole.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {canEditRoles && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false);
                              setEditedPermissions(selectedRole.permissions);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveRole}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer"
                          >
                            Save Changes
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit Privileges</span>
                        </button>
                      )}
                    </>
                  )}

                  {!selectedRole.isSystem && canEditRoles && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(selectedRole)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                      title="Delete Custom Role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Notice for master data import privilege */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-900 dark:text-amber-200 text-[11px]">
                  <strong>Security Enforcement:</strong> Only the Super Administrator has authorization to import master records. Custom roles and standard manager roles are prevented from holding this capability to protect chart of accounts integrity.
                </p>
              </div>

              {/* Permissions Checklist by Module */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {PERMISSION_MODULES.map((group) => {
                  const hasAll = group.permissions.every((p) => editedPermissions.includes(p.code));
                  const hasSome = group.permissions.some((p) => editedPermissions.includes(p.code));

                  return (
                    <div
                      key={group.module}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          {group.module}
                          {hasSome && !hasAll && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Partial
                            </span>
                          )}
                        </span>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              if (hasAll) {
                                setEditedPermissions(
                                  editedPermissions.filter((c) => !group.permissions.some((p) => p.code === c))
                                );
                              } else {
                                const newCodes = group.permissions
                                  .map((p) => p.code)
                                  .filter((code) => code !== 'master_data.import' || isSuperAdmin);
                                setEditedPermissions(Array.from(new Set([...editedPermissions, ...newCodes])));
                              }
                            }}
                            className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
                          >
                            {hasAll ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.permissions.map((perm) => {
                          const isChecked = editedPermissions.includes(perm.code);
                          const isMasterImport = perm.code === 'master_data.import';

                          return (
                            <label
                              key={perm.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs transition-colors ${
                                isChecked
                                  ? 'bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-800 text-slate-900 dark:text-white'
                                  : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                              } ${isEditing ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <input
                                type="checkbox"
                                disabled={!isEditing}
                                checked={isChecked}
                                onChange={() => handleTogglePermission(perm.code)}
                                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className="font-semibold flex items-center gap-1.5">
                                  <span>{perm.name}</span>
                                  {isMasterImport && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                      Super Admin Only
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                  {perm.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Select a role from the left to view its permissions.
            </div>
          )}
        </div>
      </div>

      {/* Create Custom Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Create New Custom Role</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="E.g., Site Procurement Auditor"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description &amp; Operational Scope
                </label>
                <textarea
                  rows={2}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Operational responsibilities and duties of this custom role..."
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-purple-600 hover:bg-purple-700 cursor-pointer shadow-xs"
                >
                  Create Custom Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesView;
