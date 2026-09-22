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
  ChevronRight,
  Clock,
  Sliders,
  LogOut,
} from 'lucide-react';
import { authService } from '../services/authService';

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
  isSupabaseConnected: _isSupabaseConnected,
  onOpenSupabaseSettings: _onOpenSupabaseSettings,
  onLogout,
}) => {
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
        {/* Company Header - Artify Construction Accounting System Logo */}
        <div className="w-full border-b border-slate-800 bg-[#070c1e] px-4 py-3 flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/25 shrink-0 border border-cyan-300/30">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wider text-white">ARTIFY</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">CAS</span>
            </div>
            <div className="text-[10px] text-cyan-400 font-semibold tracking-wide uppercase truncate">
              Construction Accounting
            </div>
            <div className="text-[9px] text-slate-400 tracking-wider uppercase font-medium">
              Sultanate of Oman
            </div>
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

        {/* Footer: Logout */}
        <div className="p-3 border-t border-slate-800">
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
