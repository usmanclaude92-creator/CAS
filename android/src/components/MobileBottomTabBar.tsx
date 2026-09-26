import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Clock,
  Building2,
  Landmark,
  ChevronUp,
  X,
  Users,
  Truck,
  Coins,
  FileBarChart,
  Layers,
  Sliders,
  ShieldAlert,
  Minimize2,
  Maximize2,
  Menu as MenuIcon,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  ArrowRightLeft,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { authService } from '../services/authService';

interface MobileBottomTabBarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  onOpenSidebar: () => void;
  pendingApprovalsCount: number;
  isTableCompact: boolean;
  onToggleTableCompact: () => void;
  onOpenMoneyIn?: () => void;
  onOpenMoneyOut?: () => void;
  onOpenClientInvoice?: () => void;
  onOpenPurchase?: () => void;
  onOpenExpense?: () => void;
  onOpenTransfer?: () => void;
}

export const MobileBottomTabBar: React.FC<MobileBottomTabBarProps> = ({
  activeView,
  onSelectView,
  onOpenSidebar,
  pendingApprovalsCount,
  isTableCompact,
  onToggleTableCompact,
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenTransfer,
}) => {
  // Collapsed state - persist user preference in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('mobile_bottom_bar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Auto-collapse on scroll down, expand on scroll up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollY;

          // If user scrolled down more than 40px and not at the very top, auto-collapse to reveal table space
          if (diff > 40 && currentScrollY > 100 && !isCollapsed) {
            setIsCollapsed(true);
          } else if (diff < -50 && isCollapsed) {
            // User scrolled up significantly, gently reveal
            setIsCollapsed(false);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isCollapsed]);

  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('mobile_bottom_bar_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  };

  const handleTabClick = (view: NavView) => {
    onSelectView(view);
    setIsMoreSheetOpen(false);
  };

  // Get active view title for collapsed pill
  const getActiveTabLabel = (view: NavView): string => {
    switch (view) {
      case 'dashboard':
      case 'project_dashboard':
        return 'Dashboard';
      case 'approvals':
        return 'Approvals';
      case 'projects':
        return 'Projects';
      case 'banking':
        return 'Banking';
      case 'customers':
        return 'Clients';
      case 'purchases':
        return 'Purchases';
      case 'expenses':
        return 'Expenses';
      case 'reports':
        return 'Reports';
      case 'masters':
        return 'Masters';
      case 'system_config':
      case 'users':
      case 'roles':
      case 'workflow_settings':
        return 'Settings';
      case 'audit':
      case 'master_import_audit':
        return 'Audit';
      default:
        return 'Navigation';
    }
  };

  const getActiveTabIcon = (view: NavView) => {
    switch (view) {
      case 'dashboard':
      case 'project_dashboard':
        return <LayoutDashboard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'approvals':
        return <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'projects':
        return <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'banking':
        return <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'customers':
        return <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'purchases':
        return <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'expenses':
        return <Coins className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'reports':
        return <FileBarChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'masters':
        return <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'system_config':
        return <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'audit':
        return <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <LayoutDashboard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const isDashboardActive = activeView === 'dashboard' || activeView === 'project_dashboard';
  const isApprovalsActive = activeView === 'approvals';
  const isProjectsActive = activeView === 'projects';
  const isBankingActive = activeView === 'banking';

  // Permission checks for views
  const hasApprovalsAccess = authService.hasPermission('approvals.view');
  const hasProjectsAccess = authService.hasPermission('projects.view');
  const hasBankingAccess = authService.hasPermission('treasury.view');
  const hasCustomersAccess = authService.hasPermission('customers.view');
  const hasPurchasesAccess = authService.hasPermission('purchases.view');
  const hasExpensesAccess = authService.hasPermission('expenses.view');
  const hasReportsAccess = authService.hasPermission('reports.view');
  const hasMastersAccess = authService.hasPermission('settings.view');
  const hasAuditAccess = authService.hasPermission('audit.view');

  return (
    <>
      {/* 1. COLLAPSED FLOATING PILL (Shown when user collapses navigation for maximum table space) */}
      <div
        className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-40 lg:hidden print:hidden transition-all duration-300 pointer-events-auto ${
          isCollapsed
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-10 scale-95 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => handleToggleCollapse(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 min-h-[48px] bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-full shadow-lg backdrop-blur-md border border-slate-700/80 hover:bg-slate-800 active:scale-95 transition-all text-xs font-semibold cursor-pointer group touch-target-min"
          aria-label="Expand navigation bar"
          title="Expand navigation bar"
        >
          <div className="flex items-center gap-1.5">
            {getActiveTabIcon(activeView)}
            <span className="text-slate-200 group-hover:text-white font-medium">
              {getActiveTabLabel(activeView)}
            </span>
          </div>

          {pendingApprovalsCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full ring-2 ring-slate-900 animate-pulse">
              {pendingApprovalsCount}
            </span>
          )}

          <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

          <span className="flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
            <span>Show Nav</span>
            <ChevronUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
          </span>
        </button>
      </div>

      {/* 2. EXPANDED BOTTOM TAB BAR */}
      <div
        className={`fixed bottom-0 inset-x-0 z-40 lg:hidden print:hidden transition-transform duration-300 ease-in-out ${
          isCollapsed ? 'translate-y-full pointer-events-none' : 'translate-y-0 pointer-events-auto'
        }`}
      >
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {/* Tab Navigation Items (48px min touch targets, Material 3 Pill Design) */}
          <nav className="grid grid-cols-4 items-center px-2 py-1 gap-1">
            {/* Tab 1: Dashboard */}
            <button
              type="button"
              onClick={() => handleTabClick('dashboard')}
              className="flex flex-col items-center justify-center py-1 px-1 min-h-[48px] rounded-xl transition-all cursor-pointer group active:scale-95"
            >
              <div
                className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDashboardActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none ${
                  isDashboardActive
                    ? 'font-bold text-indigo-600 dark:text-indigo-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Dashboard
              </span>
            </button>

            {/* Tab 2: Approvals (with badge) */}
            <button
              type="button"
              onClick={() => handleTabClick('approvals')}
              disabled={!hasApprovalsAccess}
              className={`flex flex-col items-center justify-center py-1 px-1 min-h-[48px] rounded-xl transition-all cursor-pointer group active:scale-95 ${
                !hasApprovalsAccess ? 'opacity-40 cursor-not-allowed text-slate-400' : ''
              }`}
            >
              <div className="relative">
                <div
                  className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                    isApprovalsActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-xs">
                    {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none ${
                  isApprovalsActive
                    ? 'font-bold text-indigo-600 dark:text-indigo-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Approvals
              </span>
            </button>

            {/* Tab 3: Projects */}
            <button
              type="button"
              onClick={() => handleTabClick('projects')}
              disabled={!hasProjectsAccess}
              className={`flex flex-col items-center justify-center py-1 px-1 min-h-[48px] rounded-xl transition-all cursor-pointer group active:scale-95 ${
                !hasProjectsAccess ? 'opacity-40 cursor-not-allowed text-slate-400' : ''
              }`}
            >
              <div
                className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                  isProjectsActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none ${
                  isProjectsActive
                    ? 'font-bold text-indigo-600 dark:text-indigo-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Projects
              </span>
            </button>

            {/* Tab 4: Banking / Treasury */}
            <button
              type="button"
              onClick={() => handleTabClick('banking')}
              disabled={!hasBankingAccess}
              className={`flex flex-col items-center justify-center py-1 px-1 min-h-[48px] rounded-xl transition-all cursor-pointer group active:scale-95 ${
                !hasBankingAccess ? 'opacity-40 cursor-not-allowed text-slate-400' : ''
              }`}
            >
              <div
                className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                  isBankingActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                }`}
              >
                <Landmark className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none ${
                  isBankingActive
                    ? 'font-bold text-indigo-600 dark:text-indigo-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                Banking
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* 3. SLIDE-UP "MORE MODULES & QUICK ACTIONS" BOTTOM SHEET */}
      {isMoreSheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMoreSheetOpen(false)}
          />

          {/* Slide-up Sheet */}
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto p-4 space-y-4 animate-in slide-in-from-bottom duration-200">
            {/* Header with Close */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <MenuIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Navigation &amp; Operations
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Quickly switch modules or post transactions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Shortcuts (Money In, Purchase, Expense, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Quick Financial Entry
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  OMR Accounts
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {onOpenMoneyIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      onOpenMoneyIn();
                    }}
                    className="flex flex-col items-center justify-center p-3 min-h-[52px] rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer text-center touch-target-min"
                  >
                    <ArrowDownLeft className="w-4 h-4 mb-1 text-emerald-600" />
                    <span className="text-[11px] font-semibold">Money In</span>
                  </button>
                )}

                {onOpenPurchase && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      onOpenPurchase();
                    }}
                    className="flex flex-col items-center justify-center p-3 min-h-[52px] rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer text-center touch-target-min"
                  >
                    <Truck className="w-4 h-4 mb-1 text-blue-600" />
                    <span className="text-[11px] font-semibold">Purchase Bill</span>
                  </button>
                )}

                {onOpenExpense && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      onOpenExpense();
                    }}
                    className="flex flex-col items-center justify-center p-3 min-h-[52px] rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer text-center touch-target-min"
                  >
                    <Coins className="w-4 h-4 mb-1 text-amber-600" />
                    <span className="text-[11px] font-semibold">Site Expense</span>
                  </button>
                )}

                {onOpenClientInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      onOpenClientInvoice();
                    }}
                    className="flex flex-col items-center justify-center p-3 min-h-[52px] rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 hover:bg-purple-100 transition-colors cursor-pointer text-center touch-target-min"
                  >
                    <FileText className="w-4 h-4 mb-1 text-purple-600" />
                    <span className="text-[11px] font-semibold">Client Invoice</span>
                  </button>
                )}

                {onOpenMoneyOut && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      onOpenMoneyOut();
                    }}
                    className="flex flex-col items-center justify-center p-3 min-h-[52px] rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer text-center touch-target-min"
                  >
                    <ArrowUpRight className="w-4 h-4 mb-1 text-rose-600" />
                    <span className="text-[11px] font-semibold">Money Out</span>
                  </button>
                )}

                {onOpenTransfer && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      onOpenTransfer();
                    }}
                    className="flex flex-col items-center justify-center p-3 min-h-[52px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer text-center touch-target-min"
                  >
                    <ArrowRightLeft className="w-4 h-4 mb-1 text-slate-600" />
                    <span className="text-[11px] font-semibold">Transfer</span>
                  </button>
                )}
              </div>
            </div>

            {/* All Core Business Modules Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                All Application Modules
              </span>
              <div className="grid grid-cols-2 gap-2">
                {hasCustomersAccess && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('customers')}
                    className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer ${
                      activeView === 'customers'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs">Clients &amp; Receivables</div>
                      <div className="text-[10px] text-slate-400">Invoices &amp; IPCs</div>
                    </div>
                  </button>
                )}

                {hasPurchasesAccess && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('purchases')}
                    className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer ${
                      activeView === 'purchases'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs">Vendors &amp; Payables</div>
                      <div className="text-[10px] text-slate-400">PO, Bills &amp; Dues</div>
                    </div>
                  </button>
                )}

                {hasExpensesAccess && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('expenses')}
                    className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer ${
                      activeView === 'expenses'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <Coins className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs">Direct Site Expenses</div>
                      <div className="text-[10px] text-slate-400">Petty Cash &amp; Wages</div>
                    </div>
                  </button>
                )}

                {hasReportsAccess && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('reports')}
                    className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer ${
                      activeView === 'reports'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <FileBarChart className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs">Financial Reports</div>
                      <div className="text-[10px] text-slate-400">P&amp;L, Balance Sheet</div>
                    </div>
                  </button>
                )}

                {hasMastersAccess && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('masters')}
                    className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer ${
                      activeView === 'masters'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs">Business Masters</div>
                      <div className="text-[10px] text-slate-400">Cost Codes &amp; Entities</div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleTabClick('system_config')}
                  className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer ${
                    activeView === 'system_config'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs">System Settings</div>
                    <div className="text-[10px] text-slate-400">Users, SOD &amp; Rules</div>
                  </div>
                </button>

                {hasAuditAccess && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('audit')}
                    className={`flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl border text-left transition-colors cursor-pointer col-span-2 ${
                      activeView === 'audit'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs">Immutable Audit Log</div>
                      <div className="text-[10px] text-slate-400">Cryptographic Hash Trail &amp; Edits</div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Actions: Full Sidebar & Table Spacing Options */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMoreSheetOpen(false);
                  onOpenSidebar();
                }}
                className="flex-1 py-3 px-3 min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer touch-target-min"
              >
                <MenuIcon className="w-4 h-4" />
                <span>Open Full Sidebar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleTableCompact();
                }}
                className={`py-3 px-3 min-h-[48px] rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer touch-target-min ${
                  isTableCompact
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {isTableCompact ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Compact Mode On</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Normal Spacing</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
