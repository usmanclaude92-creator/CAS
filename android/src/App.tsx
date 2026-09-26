/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar, NavView } from './components/Sidebar';
import { MobileBottomTabBar } from './components/MobileBottomTabBar';
import { MobileFloatingActionButton } from './components/MobileFloatingActionButton';
import { PullToRefresh } from './components/PullToRefresh';
import { Header } from './components/Header';
import { LoginView } from './components/auth/LoginView';

// Core Business Views
import { DashboardView } from './components/views/DashboardView';
import { ApprovalsView } from './components/views/ApprovalsView';
import { ProjectsView } from './components/views/ProjectsView';
import { BankingView } from './components/views/BankingView';
import { CustomersView } from './components/views/CustomersView';
import { PurchasesView } from './components/views/PurchasesView';
import { ExpensesView } from './components/views/ExpensesView';
import { ReportsView } from './components/views/ReportsView';
import { MastersView } from './components/views/MastersView';
import { SystemConfigurationView } from './components/views/SystemConfigurationView';
import {} from './components/views/UsersView';
import {} from './components/views/RolesView';
import {} from './components/views/WorkflowSettingsView';
import { MasterImportAuditView } from './components/views/MasterImportAuditView';
import { AuditLogView } from './components/views/AuditLogView';

// Modals
import { MoneyInModal } from './components/modals/MoneyInModal';
import { MoneyOutModal } from './components/modals/MoneyOutModal';
import { ClientInvoiceModal } from './components/modals/ClientInvoiceModal';
import { PurchaseModal } from './components/modals/PurchaseModal';
import { ExpenseModal } from './components/modals/ExpenseModal';
import { TransferModal } from './components/modals/TransferModal';
import { ReverseTransactionModal } from './components/modals/ReverseTransactionModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { NewCustomerModal } from './components/modals/NewCustomerModal';
import { NewVendorModal } from './components/modals/NewVendorModal';
import { NewBankAccountModal } from './components/modals/NewBankAccountModal';
import { SupabaseSettingsModal } from './components/modals/SupabaseSettingsModal';
import { SessionWarningModal } from './components/modals/SessionWarningModal';

import { accountingService } from './services/accountingService';
import { authService } from './services/authService';
import { supabaseService } from './services/supabaseClient';
import { sessionSecurityService, SessionSecurityState } from './services/sessionSecurityService';
import { workflowService } from './services/workflowService';
import { Transaction } from './types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(supabaseService.isConfigured());

  // Header is fixed (not sticky, which some WebView builds fail to keep
  // pinned during scroll), so its rendered height is measured and used to
  // push page content down by exactly that amount, at every breakpoint.
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(56);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const updateHeight = () => setHeaderHeight(el.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Table spacing optimization state (Compact vs Normal)
  const [isTableCompact, setIsTableCompact] = useState(() => {
    try {
      const saved = localStorage.getItem('table_density_compact');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleTableCompact = () => {
    setIsTableCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('table_density_compact', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Deep linking selections
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Modal states
  const [isMoneyInOpen, setIsMoneyInOpen] = useState(false);
  const [isMoneyOutOpen, setIsMoneyOutOpen] = useState(false);
  const [isClientInvoiceOpen, setIsClientInvoiceOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);

  // Master Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isNewVendorOpen, setIsNewVendorOpen] = useState(false);
  const [isNewBankAccountOpen, setIsNewBankAccountOpen] = useState(false);
  const [isSupabaseSettingsOpen, setIsSupabaseSettingsOpen] = useState(false);

  // Session Security & Inactivity Timeout
  const [sessionSecurity, setSessionSecurity] = useState<SessionSecurityState>(sessionSecurityService.getState());
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  // Preselected project for modal forms
  const [modalProjectId, setModalProjectId] = useState<string | undefined>(undefined);

  // Re-render tick on state updates
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubAccounting = accountingService.subscribe(() => {
      setTick((t) => t + 1);
      setIsSupabaseConnected(supabaseService.isConfigured());
    });

    const unsubAuth = authService.subscribe(() => {
      setIsAuthenticated(authService.isAuthenticated());
      setCurrentUser(authService.getCurrentUser());
      setTick((t) => t + 1);
    });

    const unsubSupabase = supabaseService.subscribe(() => {
      setIsSupabaseConnected(supabaseService.isConfigured());
      setTick((t) => t + 1);
    });

    return () => {
      unsubAccounting();
      unsubAuth();
      unsubSupabase();
    };
  }, []);

  // Track session security and auto-logout lifecycle
  useEffect(() => {
    if (!isAuthenticated) {
      sessionSecurityService.stopTracking();
      return;
    }

    sessionSecurityService.startTracking();

    const unsubSecurity = sessionSecurityService.subscribe((state) => {
      setSessionSecurity(state);
    });

    const unsubExpired = sessionSecurityService.onSessionExpired(() => {
      authService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setSessionExpiredNotice(
        'Your session expired due to inactivity. For your security and financial data protection, you have been automatically logged out.'
      );
    });

    return () => {
      unsubSecurity();
      unsubExpired();
    };
  }, [isAuthenticated]);

  const handleLogout = () => {
    sessionSecurityService.stopTracking();
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleExtendSession = () => {
    sessionSecurityService.extendSession();
  };

  const handleOpenReverse = (txn: Transaction) => {
    setReverseTarget(txn);
    setIsReverseOpen(true);
  };

  const handleOpenProjectInvoices = (projectId?: string) => {
    setModalProjectId(projectId);
    setIsClientInvoiceOpen(true);
  };

  const handleOpenProjectPurchase = (projectId?: string) => {
    setModalProjectId(projectId);
    setIsPurchaseOpen(true);
  };

  const handleOpenProjectExpense = (projectId?: string) => {
    setModalProjectId(projectId);
    setIsExpenseOpen(true);
  };

  const handleOpenProjectMoneyIn = (projectId?: string) => {
    setModalProjectId(projectId);
    setIsMoneyInOpen(true);
  };

  // If not authenticated, render Login Screen
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginView
        sessionExpiredNotice={sessionExpiredNotice}
        onClearExpiredNotice={() => setSessionExpiredNotice(null)}
        onLoginSuccess={() => {
          setSessionExpiredNotice(null);
          setIsAuthenticated(true);
          setCurrentUser(authService.getCurrentUser());
        }}
      />
    );
  }

  // Permission verification helper for current active view
  const verifyViewPermission = (view: NavView): boolean => {
    switch (view) {
      case 'dashboard':
        return authService.hasPermission('dashboard.view');
      case 'project_dashboard':
        return authService.hasPermission('projects.view');
      case 'approvals':
        return authService.hasPermission('approvals.view');
      case 'projects':
        return authService.hasPermission('projects.view');
      case 'banking':
        return authService.hasPermission('treasury.view');
      case 'customers':
        return authService.hasPermission('customers.view');
      case 'purchases':
        return authService.hasPermission('purchases.view') || authService.hasPermission('vendors.view');
      case 'expenses':
        return authService.hasPermission('expenses.view');
      case 'reports':
        return authService.hasPermission('reports.view');
      case 'masters':
        return authService.hasPermission('settings.view') || authService.isSuperAdmin();
      case 'system_config':
        return authService.hasPermission('settings.view') || authService.hasPermission('users.view') || authService.isSuperAdmin();
      case 'users':
        return authService.hasPermission('users.view');
      case 'roles':
        return authService.hasPermission('roles.view');
      case 'workflow_settings':
        return authService.hasPermission('settings.view') || authService.isSuperAdmin();
      case 'master_import_audit':
        return authService.hasPermission('audit.view') || authService.isSuperAdmin();
      case 'audit':
        return authService.hasPermission('audit.view');
      default:
        return true;
    }
  };

  const hasAccessToActiveView = verifyViewPermission(activeView);

  return (
    <div className={`min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200 ${isTableCompact ? 'compact-tables' : ''}`}>
      {/* Sidebar Navigation with dynamic RBAC filtering */}
      <Sidebar
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          if (v !== 'projects') setSelectedProjectId(null);
          if (v !== 'customers') setSelectedCustomerId(null);
          if (v !== 'purchases') setSelectedVendorId(null);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isSupabaseConnected={isSupabaseConnected}
        onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Header Bar with Theme Toggle, Global Search, Export Data & User Switcher */}
        <Header
          ref={headerRef}
          activeView={activeView}
          selectedProjectId={selectedProjectId}
          selectedCustomerId={selectedCustomerId}
          selectedVendorId={selectedVendorId}
          onNavigateView={(view) => setActiveView(view)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectProject={(id) => {
            setSelectedProjectId(id);
            setActiveView('projects');
          }}
          onSelectCustomer={(id) => {
            setSelectedCustomerId(id);
            setActiveView('customers');
          }}
          onSelectVendor={(id) => {
            setSelectedVendorId(id);
            setActiveView('purchases');
          }}
          onOpenMoneyIn={() => {
            setModalProjectId(undefined);
            setIsMoneyInOpen(true);
          }}
          onOpenMoneyOut={() => setIsMoneyOutOpen(true)}
          onOpenClientInvoice={() => {
            setModalProjectId(undefined);
            setIsClientInvoiceOpen(true);
          }}
          onOpenPurchase={() => {
            setModalProjectId(undefined);
            setIsPurchaseOpen(true);
          }}
          onOpenExpense={() => {
            setModalProjectId(undefined);
            setIsExpenseOpen(true);
          }}
          onOpenTransfer={() => setIsTransferOpen(true)}
          onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
          onLogout={handleLogout}
        />

        {/* Viewport Content with Pull-To-Refresh */}
        <PullToRefresh
          onRefresh={async () => {
            accountingService.refreshFromStorage();
            setTick((t) => t + 1);
            if (supabaseService.isConfigured()) {
              await supabaseService.testConnection().catch(() => {});
            }
          }}
        >
          <main
            className="flex-1 py-3 sm:py-6 lg:py-8 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 pb-28 sm:pb-32 lg:pb-8"
            style={{ paddingTop: headerHeight }}
          >
          {/* Access Denied View if user lacks view permission */}
          {!hasAccessToActiveView ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-4 max-w-lg mx-auto mt-12">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Access Restricted (403 Forbidden)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your current role (<strong>{currentUser.roleName}</strong>) does not have authorization to access the <strong>{activeView}</strong> module.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Executive Dashboard</span>
              </button>
            </div>
          ) : (
            <>
              {/* Dynamic Views */}
              {(activeView === 'dashboard' || activeView === 'project_dashboard') && (
                <DashboardView
                  initialScope={activeView === 'project_dashboard' ? 'project' : 'overall'}
                  initialProjectId={selectedProjectId}
                  onOpenMoneyIn={handleOpenProjectMoneyIn}
                  onOpenMoneyOut={() => setIsMoneyOutOpen(true)}
                  onOpenClientInvoice={handleOpenProjectInvoices}
                  onOpenPurchase={handleOpenProjectPurchase}
                  onOpenExpense={handleOpenProjectExpense}
                  onOpenTransfer={() => setIsTransferOpen(true)}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                  }}
                  onSelectCustomer={(id) => {
                    setSelectedCustomerId(id);
                    setActiveView('customers');
                  }}
                  onSelectVendor={(id) => {
                    setSelectedVendorId(id);
                    setActiveView('purchases');
                  }}
                  onReverseTransaction={handleOpenReverse}
                  onNavigateToProjectsList={(projectId) => {
                    if (projectId) setSelectedProjectId(projectId);
                    setActiveView('projects');
                  }}
                />
              )}

              {activeView === 'approvals' && (
                <ApprovalsView />
              )}

              {activeView === 'projects' && (
                <ProjectsView
                  selectedProjectId={selectedProjectId}
                  onClearSelectedProject={() => setSelectedProjectId(null)}
                  onSelectProject={(id) => setSelectedProjectId(id)}
                  onOpenNewProject={() => setIsNewProjectOpen(true)}
                  onOpenClientInvoice={handleOpenProjectInvoices}
                  onOpenPurchase={handleOpenProjectPurchase}
                  onOpenExpense={handleOpenProjectExpense}
                  onOpenMoneyIn={handleOpenProjectMoneyIn}
                />
              )}

              {activeView === 'banking' && (
                <BankingView
                  onOpenTransfer={() => setIsTransferOpen(true)}
                  onOpenNewBankAccount={() => setIsNewBankAccountOpen(true)}
                  onOpenMoneyIn={() => {
                    setModalProjectId(undefined);
                    setIsMoneyInOpen(true);
                  }}
                  onOpenMoneyOut={() => setIsMoneyOutOpen(true)}
                />
              )}

              {activeView === 'customers' && (
                <CustomersView
                  selectedCustomerId={selectedCustomerId}
                  onClearSelectedCustomer={() => setSelectedCustomerId(null)}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                  onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
                  onOpenClientInvoice={() => {
                    setModalProjectId(undefined);
                    setIsClientInvoiceOpen(true);
                  }}
                  onOpenMoneyIn={() => {
                    setModalProjectId(undefined);
                    setIsMoneyInOpen(true);
                  }}
                />
              )}

              {activeView === 'purchases' && (
                <PurchasesView
                  selectedVendorId={selectedVendorId}
                  onClearSelectedVendor={() => setSelectedVendorId(null)}
                  onSelectVendor={(id) => setSelectedVendorId(id)}
                  onOpenNewVendor={() => setIsNewVendorOpen(true)}
                  onOpenPurchase={() => {
                    setModalProjectId(undefined);
                    setIsPurchaseOpen(true);
                  }}
                  onOpenMoneyOut={() => setIsMoneyOutOpen(true)}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                    setActiveView('projects');
                  }}
                />
              )}

              {activeView === 'expenses' && (
                <ExpensesView
                  onOpenExpense={() => {
                    setModalProjectId(undefined);
                    setIsExpenseOpen(true);
                  }}
                  onOpenTransfer={() => setIsTransferOpen(true)}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                    setActiveView('projects');
                  }}
                />
              )}

              {activeView === 'reports' && <ReportsView />}

              {activeView === 'masters' && (
                <MastersView
                  onOpenNewProject={() => setIsNewProjectOpen(true)}
                  onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
                  onOpenNewVendor={() => setIsNewVendorOpen(true)}
                  onOpenNewBankAccount={() => setIsNewBankAccountOpen(true)}
                  onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
                />
              )}

              {activeView === 'system_config' && (
                <SystemConfigurationView
                  onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
                />
              )}

              {activeView === 'users' && (
                <SystemConfigurationView
                  initialTab="credentials"
                  onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
                />
              )}

              {activeView === 'roles' && (
                <SystemConfigurationView
                  initialTab="roles"
                  onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
                />
              )}

              {activeView === 'workflow_settings' && (
                <SystemConfigurationView
                  initialTab="workflow"
                  onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
                />
              )}

              {activeView === 'master_import_audit' && <MasterImportAuditView />}

              {activeView === 'audit' && <AuditLogView />}
            </>
          )}
        </main>
        </PullToRefresh>
      </div>

      {/* Floating Action Button (FAB) for Quick Mobile Transaction Entry */}
      <MobileFloatingActionButton
        onOpenMoneyIn={() => {
          setModalProjectId(undefined);
          setIsMoneyInOpen(true);
        }}
        onOpenMoneyOut={() => setIsMoneyOutOpen(true)}
        onOpenClientInvoice={() => {
          setModalProjectId(undefined);
          setIsClientInvoiceOpen(true);
        }}
        onOpenPurchase={() => {
          setModalProjectId(undefined);
          setIsPurchaseOpen(true);
        }}
        onOpenExpense={() => {
          setModalProjectId(undefined);
          setIsExpenseOpen(true);
        }}
        onOpenTransfer={() => setIsTransferOpen(true)}
      />

      {/* Collapsible Mobile Bottom Tab Bar */}
      <MobileBottomTabBar
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          if (v !== 'projects') setSelectedProjectId(null);
          if (v !== 'customers') setSelectedCustomerId(null);
          if (v !== 'purchases') setSelectedVendorId(null);
        }}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        pendingApprovalsCount={workflowService.getPendingApprovals().length}
        isTableCompact={isTableCompact}
        onToggleTableCompact={handleToggleTableCompact}
        onOpenMoneyIn={() => {
          setModalProjectId(undefined);
          setIsMoneyInOpen(true);
        }}
        onOpenMoneyOut={() => setIsMoneyOutOpen(true)}
        onOpenClientInvoice={() => {
          setModalProjectId(undefined);
          setIsClientInvoiceOpen(true);
        }}
        onOpenPurchase={() => {
          setModalProjectId(undefined);
          setIsPurchaseOpen(true);
        }}
        onOpenExpense={() => {
          setModalProjectId(undefined);
          setIsExpenseOpen(true);
        }}
        onOpenTransfer={() => setIsTransferOpen(true)}
      />

      {/* Transaction Modals */}
      <MoneyInModal
        isOpen={isMoneyInOpen}
        onClose={() => {
          setIsMoneyInOpen(false);
          setModalProjectId(undefined);
        }}
        preselectedProjectId={modalProjectId}
      />

      <MoneyOutModal
        isOpen={isMoneyOutOpen}
        onClose={() => setIsMoneyOutOpen(false)}
      />

      <ClientInvoiceModal
        isOpen={isClientInvoiceOpen}
        onClose={() => {
          setIsClientInvoiceOpen(false);
          setModalProjectId(undefined);
        }}
        preselectedProjectId={modalProjectId}
      />

      <PurchaseModal
        isOpen={isPurchaseOpen}
        onClose={() => {
          setIsPurchaseOpen(false);
          setModalProjectId(undefined);
        }}
        preselectedProjectId={modalProjectId}
      />

      <ExpenseModal
        isOpen={isExpenseOpen}
        onClose={() => {
          setIsExpenseOpen(false);
          setModalProjectId(undefined);
        }}
        preselectedProjectId={modalProjectId}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
      />

      {reverseTarget && (
        <ReverseTransactionModal
          isOpen={isReverseOpen}
          onClose={() => {
            setIsReverseOpen(false);
            setReverseTarget(null);
          }}
          transaction={reverseTarget}
        />
      )}

      {/* Master Data Modals */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
      />

      <NewCustomerModal
        isOpen={isNewCustomerOpen}
        onClose={() => setIsNewCustomerOpen(false)}
      />

      <NewVendorModal
        isOpen={isNewVendorOpen}
        onClose={() => setIsNewVendorOpen(false)}
      />

      <NewBankAccountModal
        isOpen={isNewBankAccountOpen}
        onClose={() => setIsNewBankAccountOpen(false)}
      />

      <SupabaseSettingsModal
        isOpen={isSupabaseSettingsOpen}
        onClose={() => setIsSupabaseSettingsOpen(false)}
      />

      {/* 60-Second Security Timeout Pre-Expiration Warning Modal */}
      <SessionWarningModal
        isOpen={sessionSecurity.isWarningOpen}
        remainingSeconds={sessionSecurity.remainingSeconds}
        onExtendSession={handleExtendSession}
        onLogoutNow={handleLogout}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
