import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Crown,
  Briefcase,
  Calculator,
  HardHat,
  Wallet,
  Eye,
  UserX,
  Building2,
  Lock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../../types/auth';

export type DemoUserTypeCategory = 'all' | 'executive' | 'management' | 'accounting' | 'treasury' | 'audit' | 'security';

interface DemoUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  demoUsers: UserProfile[];
  currentEmail: string;
  onSelectUser: (user: UserProfile) => void;
  onInstantSignIn: (user: UserProfile) => void;
  onSelectRealAdmin?: () => void;
}

interface DemoCategoryMeta {
  id: DemoUserTypeCategory;
  label: string;
  description: string;
}

const CATEGORIES: DemoCategoryMeta[] = [
  { id: 'all', label: 'All Types', description: 'All sandbox test accounts' },
  { id: 'executive', label: 'Executive', description: 'Super Administrator & Governance' },
  { id: 'management', label: 'Management', description: 'Accounts & Finance Managers' },
  { id: 'accounting', label: 'Accounting & Ops', description: 'Senior & Project Site Accountants' },
  { id: 'treasury', label: 'Treasury', description: 'Cashier & Banking Disbursements' },
  { id: 'audit', label: 'Audit', description: 'Compliance & Read-Only Auditor' },
  { id: 'security', label: 'Security Test', description: 'Inactive Account Block' },
];

export const DemoUsersModal: React.FC<DemoUsersModalProps> = ({
  isOpen,
  onClose,
  demoUsers,
  currentEmail,
  onSelectUser,
  onInstantSignIn,
  onSelectRealAdmin,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DemoUserTypeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const getUserCategory = (user: UserProfile): DemoUserTypeCategory => {
    if (user.status === 'inactive') return 'security';
    if (user.roleCode === 'super_admin') return 'executive';
    if (user.roleCode === 'accounts_manager' || user.roleCode === 'finance_manager') return 'management';
    if (user.roleCode === 'accountant' || user.roleCode === 'project_accountant') return 'accounting';
    if (user.roleCode === 'treasury_user') return 'treasury';
    if (user.roleCode === 'viewer') return 'audit';
    return 'management';
  };

  const getUserTypeBadge = (user: UserProfile) => {
    if (user.status === 'inactive') {
      return {
        label: 'Security Sandbox',
        color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        icon: UserX,
      };
    }
    switch (user.roleCode) {
      case 'super_admin':
        return {
          label: 'Executive & Governance',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-900',
          icon: Crown,
        };
      case 'accounts_manager':
        return {
          label: 'Management & Approvals (≤25k)',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900',
          icon: Briefcase,
        };
      case 'finance_manager':
        return {
          label: 'Financial Control (≤10k)',
          color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
          icon: Briefcase,
        };
      case 'accountant':
        return {
          label: 'Operational Accounting',
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
          icon: Calculator,
        };
      case 'project_accountant':
        return {
          label: 'Project Site Ops (Restricted)',
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900',
          icon: HardHat,
        };
      case 'treasury_user':
        return {
          label: 'Treasury & Cashier',
          color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-900',
          icon: Wallet,
        };
      case 'viewer':
        return {
          label: 'External Audit (Read-Only)',
          color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          icon: Eye,
        };
      default:
        return {
          label: user.roleName,
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900',
          icon: ShieldCheck,
        };
    }
  };

  const filteredUsers = demoUsers.filter((user) => {
    const category = getUserCategory(user);
    if (selectedCategory !== 'all' && category !== selectedCategory) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = user.fullName.toLowerCase().includes(q);
      const matchRole = user.roleName.toLowerCase().includes(q);
      const matchEmail = user.email.toLowerCase().includes(q);
      const matchDept = user.department?.toLowerCase().includes(q) || false;
      const matchRemarks = user.remarks?.toLowerCase().includes(q) || false;
      return matchName || matchRole || matchEmail || matchDept || matchRemarks;
    }

    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-users-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="demo-users-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Demo User Profiles &amp; Roles
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  Isolated Sandbox
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select any predefined demo account to test role permissions, approval thresholds, and project restrictions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real Production Superadmin Quick Switch Banner */}
        {onSelectRealAdmin && (
          <div className="mx-4 sm:mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5 flex-wrap">
                  <span>Real Superadmin: <strong>admin@artifysols.com</strong></span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200/70 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-semibold">
                    Blank Production DB
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                  Enterprise governance with clean production ledger (zero demo artifacts)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSelectRealAdmin}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs cursor-pointer shrink-0 transition-colors"
            >
              Select Real Admin
            </button>
          </div>
        )}

        {/* Filter Bar & Search */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, department, or keyword..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {CATEGORIES.map((cat) => {
              const count = demoUsers.filter(
                (u) => cat.id === 'all' || getUserCategory(u) === cat.id
              ).length;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              No demo users found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUsers.map((user) => {
                const badge = getUserTypeBadge(user);
                const BadgeIcon = badge.icon;
                const isCurrent = currentEmail.toLowerCase() === user.email.toLowerCase();
                const isInactive = user.status === 'inactive';

                return (
                  <div
                    key={user.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-left relative ${
                      isCurrent
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-500/30'
                        : isInactive
                        ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/10 hover:border-rose-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                    }`}
                  >
                    {/* Active Selection Pin */}
                    {isCurrent && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/70 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Current</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      {/* Top Role Badge */}
                      <div className="flex items-center gap-1.5 flex-wrap pr-16">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.color}`}
                        >
                          <BadgeIcon className="w-3 h-3 shrink-0" />
                          <span>{badge.label}</span>
                        </span>

                        {/* Project Scope pill */}
                        {!user.isAllProjects ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            PRJ-AKV-001 Only
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                            All Projects
                          </span>
                        )}
                      </div>

                      {/* User Info */}
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{user.fullName}</span>
                          {isInactive && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              Inactive
                            </span>
                          )}
                        </h4>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          {user.roleName}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{user.department}</span>
                          <span>&bull;</span>
                          <span className="font-mono">{user.employeeId}</span>
                        </div>
                      </div>

                      {/* Remarks / Governance Description */}
                      {user.remarks && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          {user.remarks}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[140px]">
                        {user.email}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Select Credentials button */}
                        <button
                          type="button"
                          onClick={() => onSelectUser(user)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Fills credentials in login form and closes dialog"
                        >
                          Select
                        </button>

                        {/* Instant Sign In button */}
                        <button
                          type="button"
                          onClick={() => onInstantSignIn(user)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                            isInactive
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          title={isInactive ? 'Test inactive block rejection' : 'Log in immediately as this user'}
                        >
                          <span>{isInactive ? 'Test Block' : 'Sign In'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Sandbox password: <strong className="font-mono text-slate-700 dark:text-slate-300">Construction@2026</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
