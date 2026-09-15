import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Landmark,
  Users,
  Truck,
  Coins,
  FileBarChart,
  Layers,
  ShieldAlert,
  Database,
  ChevronRight,
  HardHat,
  Clock,
  UserCheck,
  Shield,
  Sliders,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import { authService } from '../services/authService';

export type NavView =
  | 'dashboard'
  | 'projects'
  | 'banking'
  | 'customers'
  | 'purchases'
  | 'expenses'
  | 'approvals'
  | 'reports'
  | 'masters'
  | 'users'
  | 'roles'
  | 'workflow_settings'
  | 'master_import_audit'
  | 'audit';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  isOpen: boolean;
  onClose: () => void;
  isSupabaseConnected: boolean;
  onOpenSupabaseSettings: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isOpen,
  onClose,
  isSupabaseConnected,
  onOpenSupabaseSettings,
  onLogout,
}) => {
  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = authService.isSuperAdmin();

  // All possible navigation items with permission checks
  const allNavItems: {
    id: NavView;
    label: string;
    icon: React.FC<{ className?: string }>;
    permission?: string;
    superAdminOnly?: boolean;
    badge?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    { id: 'approvals', label: 'Pending Approvals', icon: Clock, permission: 'approvals.view' },
    { id: 'projects', label: 'Projects & Costing', icon: Building2, permission: 'projects.view' },
    { id: 'banking', label: 'Banking & Treasury', icon: Landmark, permission: 'treasury.view' },
    { id: 'customers', label: 'Clients & Receivables', icon: Users, permission: 'customers.view' },
    { id: 'purchases', label: 'Vendors & Payables', icon: Truck, permission: 'purchases.view' },
    { id: 'expenses', label: 'Direct Site Expenses', icon: Coins, permission: 'expenses.view' },
    { id: 'reports', label: 'Financial Reports', icon: FileBarChart, permission: 'reports.view' },
    { id: 'masters', label: 'Masters & Setup', icon: Layers, permission: 'settings.view' },
    { id: 'users', label: 'User Directory', icon: UserCheck, permission: 'users.view' },
    { id: 'roles', label: 'Roles & RBAC', icon: Shield, permission: 'roles.view' },
    { id: 'workflow_settings', label: 'Approval Governance', icon: Sliders, permission: 'settings.view' },
    {
      id: 'master_import_audit',
      label: 'Import Audit Trail',
      icon: FileSpreadsheet,
      permission: 'audit.view',
      superAdminOnly: false,
    },
    { id: 'audit', label: 'Immutable Audit Log', icon: ShieldAlert, permission: 'audit.view' },
  ];

  // Filter based on user permissions
  const visibleNavItems = allNavItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (!item.permission) return true;
    return authService.hasPermission(item.permission);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 border-r border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Company Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0">
            <HardHat className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white tracking-tight truncate">Construction ERP</h1>
            <p className="text-[11px] text-amber-400 font-medium truncate">Accounting &bull; OMR 3-Dec</p>
          </div>
        </div>

        {/* User Profile & Project Scope Badge */}
        <div className="px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="truncate">{currentUser?.fullName || 'Authenticated User'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/80 text-blue-200 uppercase tracking-wider font-mono">
              {currentUser?.roleCode?.replace('_', ' ')}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {currentUser?.isAllProjects ? (
              <span className="text-emerald-400 font-medium">&bull; All Projects Unrestricted</span>
            ) : (
              <span className="text-amber-400 font-medium">
                &bull; Scope: {currentUser?.assignedProjectIds?.join(', ') || 'Assigned Only'}
              </span>
            )}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200 shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Footer: Database & Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={onOpenSupabaseSettings}
            className="w-full p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-left border border-slate-700/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Supabase Engine
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-blue-400'
                }`}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {isSupabaseConnected ? 'PostgreSQL RLS Active' : 'Dual-Engine Ready'}
            </p>
          </button>

          <button
            onClick={onLogout}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-transparent hover:border-rose-900 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
