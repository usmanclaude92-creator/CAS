import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Truck,
  Coins,
  ArrowRightLeft,
  ChevronDown,
  User,
  ShieldCheck,
  LogOut,
  Sparkles,
  Layers,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { authService } from '../services/authService';
import { ThemeToggle } from './ThemeToggle';
import { HeaderNotifications } from './HeaderNotifications';
import { UserProfile } from '../types/auth';

interface HeaderProps {
  activeView: NavView;
  onToggleSidebar: () => void;
  onOpenMoneyIn: () => void;
  onOpenMoneyOut: () => void;
  onOpenClientInvoice: () => void;
  onOpenPurchase: () => void;
  onOpenExpense: () => void;
  onOpenTransfer: () => void;
  onOpenSupabaseSettings: () => void;
  onLogout: () => void;
  onNavigateView?: (view: NavView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onToggleSidebar,
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenTransfer,
  onOpenSupabaseSettings,
  onLogout,
  onNavigateView,
}) => {
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [allUsers, setAllUsers] = useState<UserProfile[]>(authService.getUsers());

  const quickMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reload = () => {
      setCurrentUser(authService.getCurrentUser());
      setAllUsers(authService.getUsers());
    };
    reload();
    const unsub = authService.subscribe(reload);
    return () => unsub();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(event.target as Node)) {
        setIsQuickOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchUser = (userId: string) => {
    authService.switchUser(userId);
    setIsUserMenuOpen(false);
  };

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Executive Financial Dashboard';
      case 'approvals':
        return 'Pending Approvals & Governance Queue';
      case 'projects':
        return 'Construction Projects & Cost Accounting';
      case 'banking':
        return 'Commercial Banking & Treasury Operations';
      case 'customers':
        return 'Customers & Accounts Receivable';
      case 'purchases':
        return 'Vendors, Materials & Accounts Payable';
      case 'expenses':
        return 'Direct Project & Site Expenses';
      case 'reports':
        return 'Financial Statements & Reports';
      case 'masters':
        return 'Chart of Accounts & System Masters';
      case 'users':
        return 'User Management & Security Profiles';
      case 'roles':
        return 'Role-Based Access Control (RBAC)';
      case 'workflow_settings':
        return 'Approval Thresholds & SOD Governance';
      case 'master_import_audit':
        return 'Master Data Import Governance Logs';
      case 'audit':
        return 'Immutable System Audit Trail';
    }
  };

  // Permission checks for quick transaction creation
  const canCreateInvoice = authService.hasPermission('invoices.create');
  const canCreateReceipt = authService.hasPermission('money_in.create');
  const canCreatePurchase = authService.hasPermission('purchases.create');
  const canCreatePayment = authService.hasPermission('money_out.create');
  const canCreateExpense = authService.hasPermission('expenses.create');
  const canCreateTransfer = authService.hasPermission('transfers.create');
  const canCreateAny =
    canCreateInvoice ||
    canCreateReceipt ||
    canCreatePurchase ||
    canCreatePayment ||
    canCreateExpense ||
    canCreateTransfer;

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 transition-colors duration-200">
      {/* Title and Sidebar toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {getTitle()}
          </h1>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>Muscat, Sultanate of Oman</span>
            <span>&bull;</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              OMR (3-Decimals)
            </span>
          </div>
        </div>
      </div>

      {/* Right controls: Theme Toggle, Quick Transaction, User Switcher */}
      <div className="flex items-center gap-3">
        {/* Global Dark / Light Theme Toggle */}
        <ThemeToggle variant="simple" />

        {/* Quick Transaction Action Dropdown (Hides if user cannot create anything, e.g. Viewer) */}
        {canCreateAny && (
          <div className="relative" ref={quickMenuRef}>
            <button
              onClick={() => setIsQuickOpen(!isQuickOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Transaction</span>
              <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
            </button>

            {isQuickOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs animate-in fade-in">
                {canCreateInvoice && (
                  <button
                    onClick={() => {
                      setIsQuickOpen(false);
                      onOpenClientInvoice();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>+ Client Invoice / IPC</span>
                  </button>
                )}
                {canCreateReceipt && (
                  <button
                    onClick={() => {
                      setIsQuickOpen(false);
                      onOpenMoneyIn();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>+ Money In (Receipt)</span>
                  </button>
                )}
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                {canCreatePurchase && (
                  <button
                    onClick={() => {
                      setIsQuickOpen(false);
                      onOpenPurchase();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>+ Vendor Purchase Bill</span>
                  </button>
                )}
                {canCreatePayment && (
                  <button
                    onClick={() => {
                      setIsQuickOpen(false);
                      onOpenMoneyOut();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>+ Money Out (Payment)</span>
                  </button>
                )}
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                {canCreateExpense && (
                  <button
                    onClick={() => {
                      setIsQuickOpen(false);
                      onOpenExpense();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <Coins className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>+ Direct Site Expense</span>
                  </button>
                )}
                {canCreateTransfer && (
                  <button
                    onClick={() => {
                      setIsQuickOpen(false);
                      onOpenTransfer();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>+ Bank / Cash Transfer</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Account Switcher Dropdown (Allows reviewers to effortlessly test roles) */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                {currentUser?.fullName}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                {currentUser?.roleName}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 text-xs animate-in fade-in">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                  Switch Active Role (Test Sandbox)
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto py-1">
                {allUsers
                  .filter((u) => u.status === 'active')
                  .map((u) => {
                    const isSelected = u.id === currentUser?.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSwitchUser(u.id)}
                        className={`w-full px-3.5 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-blue-500" />
                        <div className="flex-1 overflow-hidden">
                          <div className="truncate text-xs">{u.fullName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {u.roleName}
                            {!u.isAllProjects && (
                              <span className="text-amber-500 ml-1">({u.assignedProjectIds.length} project)</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
