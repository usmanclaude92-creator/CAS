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
  Settings,
  Handshake,
} from 'lucide-react';
import { authService } from '../services/authService';

export type NavView =
  | 'dashboard'
  | 'project_dashboard'
  | 'projects'
  | 'banking'
  | 'customers'
  | 'purchases'
  | 'business_partners'
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
  onLogout: _onLogout,
}) => {
  const isSuperAdmin = authService.isSuperAdmin();

  // All possible navigation items with permission checks
  const allNavItems: {
    id: NavView;
    label: string;
    icon: React.FC<{ className?: string }>;
    permission?: string;
    superAdminOnly?: boolean;
    section?: 'main' | 'masters' | 'audit';
    badge?: string;
  }[] = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', section: 'main' },
    { id: 'approvals', label: 'Pending Approvals', icon: Clock, permission: 'approvals.view', section: 'main' },
    { id: 'projects', label: 'Projects & Costing', icon: Building2, permission: 'projects.view', section: 'main' },
    { id: 'banking', label: 'Banking & Treasury', icon: Landmark, permission: 'treasury.view', section: 'main' },
    { id: 'customers', label: 'Clients & Receivables', icon: Users, permission: 'customers.view', section: 'main' },
    { id: 'purchases', label: 'Vendors & Payables', icon: Truck, permission: 'purchases.view', section: 'main' },
    { id: 'business_partners', label: 'Business Partners', icon: Handshake, permission: 'business_partners.view', section: 'main' },
    { id: 'expenses', label: 'Direct Site Expenses', icon: Coins, permission: 'expenses.view', section: 'main' },
    { id: 'reports', label: 'Financial Reports', icon: FileBarChart, permission: 'reports.view', section: 'main' },
    { id: 'masters', label: 'Business Masters', icon: Layers, permission: 'settings.view', section: 'masters' },
    { id: 'audit', label: 'Immutable Audit Log', icon: ShieldAlert, permission: 'audit.view', section: 'audit' },
  ];

  // Filter based on user permissions
  const visibleNavItems = allNavItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (!item.permission) return true;
    return authService.hasPermission(item.permission);
  });

  const canAccessSystemConfig = isSuperAdmin || authService.hasPermission('settings.view');

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
        {/* Company Header - Artify Construction Accounting System Logo Image */}
        <div className="w-full border-b border-slate-800 bg-slate-900 flex items-center justify-center py-2.5 overflow-hidden">
          <img
            src="/artify-logo.png"
            alt="Artify Construction Accounting System"
            className="w-[90%] h-auto object-contain block hover:opacity-95 transition-opacity select-none bg-transparent"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith('/image.png')) {
                target.src = '/image.png';
              }
            }}
          />
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
                {isNewSection && item.section === 'audit' && (
                  <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Audit &amp; Authentication
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

        {/* Footer: System Configuration (Replacing Sign Out) */}
        {canAccessSystemConfig && (
          <div className="p-3 border-t border-slate-800">
            <button
              onClick={() => {
                onSelectView('system_config');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeView === 'system_config'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Settings className={`w-4 h-4 shrink-0 ${activeView === 'system_config' ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">System Configuration</span>
              </div>
              {activeView === 'system_config' && <ChevronRight className="w-3.5 h-3.5 text-blue-200 shrink-0" />}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
