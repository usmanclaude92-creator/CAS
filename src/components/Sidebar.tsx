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
  BarChart3,
} from 'lucide-react';
import { authService } from '../services/authService';
import { ArtifyLogo } from './ArtifyLogo';

export type NavView =
  | 'dashboard'
  | 'project_dashboard'
  | 'projects'
  | 'banking'
  | 'customers'
  | 'purchases'
  | 'expenses'
  | 'approvals'
  | 'reports'
  | 'masters'
  | 'system_config'
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
    section?: 'main' | 'masters' | 'system';
    badge?: string;
  }[] = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', section: 'main' },
    { id: 'approvals', label: 'Pending Approvals', icon: Clock, permission: 'approvals.view', section: 'main' },
    { id: 'projects', label: 'Projects & Costing', icon: Building2, permission: 'projects.view', section: 'main' },
    { id: 'banking', label: 'Banking & Treasury', icon: Landmark, permission: 'treasury.view', section: 'main' },
    { id: 'customers', label: 'Clients & Receivables', icon: Users, permission: 'customers.view', section: 'main' },
    { id: 'purchases', label: 'Vendors & Payables', icon: Truck, permission: 'purchases.view', section: 'main' },
    { id: 'expenses', label: 'Direct Site Expenses', icon: Coins, permission: 'expenses.view', section: 'main' },
    { id: 'reports', label: 'Financial Reports', icon: FileBarChart, permission: 'reports.view', section: 'main' },
    { id: 'masters', label: 'Business Masters', icon: Layers, permission: 'settings.view', section: 'masters' },
    { id: 'system_config', label: 'System Configuration', icon: Sliders, permission: 'settings.view', section: 'system' },
    { id: 'audit', label: 'Immutable Audit Log', icon: ShieldAlert, permission: 'audit.view', section: 'system' },
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
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden print:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 border-r border-slate-800 print:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Company Header - Replaced with Artify Construction Accounting System Logo (Image 1) */}
        <div className="p-3 border-b border-slate-800 bg-[#070c1e] flex items-center justify-center">
          <ArtifyLogo className="w-full h-auto max-h-12 hover:opacity-95 transition-opacity" />
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
          {visibleNavItems.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              activeView === item.id || (item.id === 'dashboard' && activeView === 'project_dashboard');
            const prevItem = visibleNavItems[index - 1];
            const isNewSection = !prevItem || prevItem.section !== item.section;

            return (
              <React.Fragment key={item.id}>
                {isNewSection && item.section === 'masters' && (
                  <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Master Data
                  </div>
                )}
                {isNewSection && item.section === 'system' && (
                  <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Administration &amp; Setup
                  </div>
                )}
                <button
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
              </React.Fragment>
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
