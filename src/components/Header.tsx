import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Search,
  X,
  Building2,
  Users,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { authService } from '../services/authService';
import { accountingService } from '../services/accountingService';
import { formatOMR } from '../utils/formatters';
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
  onSelectProject?: (projectId: string) => void;
  onSelectCustomer?: (customerId: string) => void;
  onSelectVendor?: (vendorId: string) => void;
}

type SearchResultItem = {
  type: 'project' | 'vendor' | 'customer';
  id: string;
  title: string;
  code: string;
  subtitle: string;
  badge: string;
  detail?: string;
};

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
  onSelectProject,
  onSelectCustomer,
  onSelectVendor,
}) => {
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());
  const [allUsers, setAllUsers] = useState<UserProfile[]>(authService.getUsers());

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<'all' | 'projects' | 'vendors' | 'customers'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [accountingData, setAccountingData] = useState(() => accountingService.getState());

  const quickMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reload = () => {
      setCurrentUser(authService.getCurrentUser());
      setAllUsers(authService.getUsers());
    };
    reload();
    const unsub = authService.subscribe(reload);
    return () => unsub();
  }, []);

  // Subscribe to accounting state updates so new projects/vendors/customers appear in search
  useEffect(() => {
    const unsub = accountingService.subscribe(() => {
      setAccountingData(accountingService.getState());
    });
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
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener (/ or Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSwitchUser = (userId: string) => {
    authService.switchUser(userId);
    setIsUserMenuOpen(false);
  };

  // Search Results filtering
  const filteredResults = useMemo<SearchResultItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const items: SearchResultItem[] = [];

    const projects = accountingData.projects || [];
    const vendors = accountingData.vendors || [];
    const customers = accountingData.customers || [];

    if (!q) {
      // Empty state shows top active entities for quick navigation
      if (searchCategory === 'all' || searchCategory === 'projects') {
        projects.slice(0, 3).forEach((p) => {
          items.push({
            type: 'project',
            id: p.id,
            title: p.name,
            code: p.code,
            subtitle: p.customerName ? `Client: ${p.customerName}` : 'Construction Project',
            badge: formatOMR(p.contractValue),
            detail: p.status.toUpperCase(),
          });
        });
      }
      if (searchCategory === 'all' || searchCategory === 'customers') {
        customers.slice(0, 3).forEach((c) => {
          items.push({
            type: 'customer',
            id: c.id,
            title: c.name,
            code: c.code,
            subtitle: c.contactPerson ? `Contact: ${c.contactPerson}` : (c.phone || 'Client Account'),
            badge: 'Customer',
          });
        });
      }
      if (searchCategory === 'all' || searchCategory === 'vendors') {
        vendors.slice(0, 3).forEach((v) => {
          items.push({
            type: 'vendor',
            id: v.id,
            title: v.name,
            code: v.code,
            subtitle: v.category ? `Category: ${v.category}` : (v.contactPerson || 'Vendor / Supplier'),
            badge: 'Vendor',
          });
        });
      }
      return items;
    }

    // Filter projects
    if (searchCategory === 'all' || searchCategory === 'projects') {
      projects
        .filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.customerName && p.customerName.toLowerCase().includes(q))
        )
        .forEach((p) => {
          items.push({
            type: 'project',
            id: p.id,
            title: p.name,
            code: p.code,
            subtitle: p.customerName ? `Client: ${p.customerName}` : 'Construction Project',
            badge: formatOMR(p.contractValue),
            detail: p.status.toUpperCase(),
          });
        });
    }

    // Filter customers
    if (searchCategory === 'all' || searchCategory === 'customers') {
      customers
        .filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q))
        )
        .forEach((c) => {
          items.push({
            type: 'customer',
            id: c.id,
            title: c.name,
            code: c.code,
            subtitle: c.contactPerson ? `Contact: ${c.contactPerson}` : (c.phone || 'Client Account'),
            badge: 'Customer',
          });
        });
    }

    // Filter vendors
    if (searchCategory === 'all' || searchCategory === 'vendors') {
      vendors
        .filter((v) =>
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          (v.category && v.category.toLowerCase().includes(q)) ||
          (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
          (v.phone && v.phone.toLowerCase().includes(q))
        )
        .forEach((v) => {
          items.push({
            type: 'vendor',
            id: v.id,
            title: v.name,
            code: v.code,
            subtitle: v.category ? `Category: ${v.category}` : (v.contactPerson || 'Vendor / Supplier'),
            badge: 'Vendor',
          });
        });
    }

    return items;
  }, [searchQuery, searchCategory, accountingData]);

  // Category counts for quick filtering pills
  const categoryCounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const projects = accountingData.projects || [];
    const vendors = accountingData.vendors || [];
    const customers = accountingData.customers || [];

    if (!q) {
      return {
        all: projects.length + vendors.length + customers.length,
        projects: projects.length,
        vendors: vendors.length,
        customers: customers.length,
      };
    }

    const pCount = projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.customerName && p.customerName.toLowerCase().includes(q))
    ).length;

    const vCount = vendors.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      (v.category && v.category.toLowerCase().includes(q)) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
      (v.phone && v.phone.toLowerCase().includes(q))
    ).length;

    const cCount = customers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    ).length;

    return {
      all: pCount + vCount + cCount,
      projects: pCount,
      vendors: vCount,
      customers: cCount,
    };
  }, [searchQuery, accountingData]);

  // Reset selected index when query or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, searchCategory]);

  const handleSelectItem = (item: SearchResultItem) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    if (item.type === 'project') {
      if (onSelectProject) {
        onSelectProject(item.id);
      } else if (onNavigateView) {
        onNavigateView('projects');
      }
    } else if (item.type === 'customer') {
      if (onSelectCustomer) {
        onSelectCustomer(item.id);
      } else if (onNavigateView) {
        onNavigateView('customers');
      }
    } else if (item.type === 'vendor') {
      if (onSelectVendor) {
        onSelectVendor(item.id);
      } else if (onNavigateView) {
        onNavigateView('purchases');
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelectItem(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
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
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 sm:gap-4 transition-colors duration-200 print:hidden">
      {/* Title and Sidebar toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
            {getTitle()}
          </h1>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2">
            <span>Muscat, Sultanate of Oman</span>
            <span>&bull;</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              OMR (3-Decimals)
            </span>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-1 sm:mx-3 relative" ref={searchContainerRef}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
            isSearchOpen
              ? 'bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search projects, vendors, customers..."
            className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            aria-label="Global search projects, vendors, customers"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs">
              /
            </kbd>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden max-h-[75vh] sm:max-h-[460px] flex flex-col animate-in fade-in">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/90 text-xs">
              {[
                { id: 'all', label: 'All', count: categoryCounts.all },
                { id: 'projects', label: 'Projects', count: categoryCounts.projects },
                { id: 'vendors', label: 'Vendors', count: categoryCounts.vendors },
                { id: 'customers', label: 'Customers', count: categoryCounts.customers },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSearchCategory(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    searchCategory === tab.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1 rounded-full ${
                      searchCategory === tab.id
                        ? 'bg-white/20 dark:bg-black/10 text-white dark:text-slate-900'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredResults.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    No results found for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Try searching with a different keyword, code, or contact name.
                  </p>
                </div>
              ) : (
                <>
                  {!searchQuery && (
                    <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      Quick Access Directory
                    </div>
                  )}

                  {filteredResults.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelectItem(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full px-3 py-2.5 rounded-lg text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Icon per type */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              item.type === 'project'
                                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60'
                                : item.type === 'customer'
                                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60'
                                : 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60'
                            }`}
                          >
                            {item.type === 'project' && <Building2 className="w-4 h-4" />}
                            {item.type === 'customer' && <Users className="w-4 h-4" />}
                            {item.type === 'vendor' && <Truck className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate">{item.title}</span>
                              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {item.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              item.type === 'project'
                                ? 'bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                                : item.type === 'customer'
                                ? 'bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100/70 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {item.type}
                          </span>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition-transform ${
                              isSelected ? 'text-blue-600 dark:text-blue-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Keyboard guidance footer */}
            <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span>Use &uarr; &darr; to navigate &bull; ↵ to select</span>
              <span>ESC to close</span>
            </div>
          </div>
        )}
      </div>

      {/* Right controls: Theme Toggle, Quick Transaction, User Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

        {/* In-App Notifications Bell */}
        {onNavigateView && (
          <HeaderNotifications onNavigateView={onNavigateView} />
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

