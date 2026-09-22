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
  Search,
  X,
  Building2,
  Users,
  ArrowRight,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { authService } from '../services/authService';
import { accountingService } from '../services/accountingService';
import { sessionSecurityService } from '../services/sessionSecurityService';
import { exportActiveView, ExportFormat, getActiveViewExportData } from '../services/exportService';
import { formatOMR } from '../utils/formatters';
import { ThemeToggle } from './ThemeToggle';
import { HeaderNotifications } from './HeaderNotifications';
import { UserProfile } from '../types/auth';

interface HeaderProps {
  activeView: NavView;
  selectedProjectId?: string | null;
  selectedCustomerId?: string | null;
  selectedVendorId?: string | null;
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

const getTypeIcon = (type: 'project' | 'vendor' | 'customer') => {
  if (type === 'project') return <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
  if (type === 'customer') return <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  return <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
};

const getTypeBadge = (type: 'project' | 'vendor' | 'customer') => {
  if (type === 'project') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
        Project
      </span>
    );
  }
  if (type === 'customer') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
        Customer
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-amber-100/70 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
      Vendor
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  activeView,
  selectedProjectId,
  selectedCustomerId,
  selectedVendorId,
  onToggleSidebar,
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenTransfer,
  onOpenSupabaseSettings: _onOpenSupabaseSettings,
  onLogout,
  onNavigateView,
  onSelectProject,
  onSelectCustomer,
  onSelectVendor,
}) => {
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [lastExportStatus, setLastExportStatus] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<'all' | 'projects' | 'vendors' | 'customers'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [accountingData, setAccountingData] = useState(() => accountingService.getState());

  const quickMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reload = () => {
      setCurrentUser(authService.getCurrentUser());
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
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
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

  // Active view table metadata for export preview
  const activeExportMeta = useMemo(() => {
    const exportOpts = getActiveViewExportData(activeView, {
      projectId: selectedProjectId,
      customerId: selectedCustomerId,
      vendorId: selectedVendorId,
    });
    return {
      title: exportOpts.title,
      recordCount: exportOpts.data.length,
    };
  }, [activeView, selectedProjectId, selectedCustomerId, selectedVendorId, accountingData]);

  // Handle triggered export for active view table data
  const handleExport = (format: ExportFormat) => {
    try {
      const result = exportActiveView(format, activeView, {
        projectId: selectedProjectId,
        customerId: selectedCustomerId,
        vendorId: selectedVendorId,
      });
      setLastExportStatus(`Downloaded ${result.recordCount} rows as ${format.toUpperCase()}`);
      setTimeout(() => {
        setIsExportOpen(false);
        setLastExportStatus(null);
      }, 1600);
    } catch (err: any) {
      console.error('Export failed:', err);
      setLastExportStatus(`Export failed: ${err.message || 'Unknown error'}`);
    }
  };

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
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-colors duration-200 print:hidden min-h-[56px] w-full max-w-full">
      {/* Title and Sidebar toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 max-w-[55%] sm:max-w-none">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 -ml-1 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer touch-target-min"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
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

      {/* Center: Global Search Bar (Hidden on Mobile screens, visible on md+) */}
      <div className="hidden md:flex flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-1 sm:mx-3 relative" ref={searchContainerRef}>
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

      {/* Right controls: Mobile Search, Theme Toggle, Export Data, Quick Transaction, User Switcher */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Mobile Search Button (Tap opens Search overlay) */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer touch-target-min"
          aria-label="Search"
          title="Search projects, vendors, customers"
        >
          <Search className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>

        {/* Global Dark / Light Theme Toggle */}
        <ThemeToggle variant="simple" />

        {/* Export Data Button with CSV / Excel / PDF Options for Active View Table (Hidden on small mobile) */}
        <div className="relative hidden sm:block" ref={exportMenuRef}>
          <button
            type="button"
            id="header-export-data-btn"
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
            title={`Export visible ${activeExportMeta.recordCount} rows in ${activeView}`}
            aria-label="Export Data"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="hidden sm:inline">Export Data</span>
            <span className="sm:hidden">Export</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isExportOpen ? 'rotate-180' : ''}`} />
          </button>

          {isExportOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs animate-in fade-in">
              {/* Active View Preview */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                  Active View Table
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[155px]" title={activeExportMeta.title}>
                    {activeExportMeta.title.replace('Artify - ', '')}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 shrink-0">
                    {activeExportMeta.recordCount} rows
                  </span>
                </div>
              </div>

              {/* Format Options */}
              <div className="p-1 space-y-0.5">
                {/* Excel Export */}
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  className="w-full px-2.5 py-2 text-left flex items-center justify-between rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 group transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Auto-formatted workbook</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-100/50 dark:bg-emerald-900/30 shrink-0">
                    XLSX
                  </span>
                </button>

                {/* CSV Export */}
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full px-2.5 py-2 text-left flex items-center justify-between rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 group transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">CSV (.csv)</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">UTF-8 comma-separated</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-100/50 dark:bg-blue-950/30 shrink-0">
                    CSV
                  </span>
                </button>

                {/* PDF Export */}
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="w-full px-2.5 py-2 text-left flex items-center justify-between rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 group transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">PDF Document (.pdf)</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Formatted printable tables</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded bg-rose-100/50 dark:bg-rose-950/30 shrink-0">
                    PDF
                  </span>
                </button>
              </div>

              {/* Status Message */}
              {lastExportStatus && (
                <div className="mx-2 my-1 px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate font-medium">{lastExportStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Transaction Action Dropdown (Hidden on mobile; on mobile the FAB + bottom sheet handles this) */}
        {canCreateAny && (
          <div className="relative hidden md:block" ref={quickMenuRef}>
            <button
              onClick={() => setIsQuickOpen(!isQuickOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Transaction</span>
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

        {/* In-App Notifications Bell (Hidden on tiny screens to avoid overflow) */}
        {onNavigateView && (
          <div className="hidden sm:block">
            <HeaderNotifications onNavigateView={onNavigateView} />
          </div>
        )}

        {/* User Account Switcher Dropdown (Allows reviewers to effortlessly test roles) */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-full sm:rounded-xl border border-transparent sm:border-slate-200 dark:sm:border-slate-700 bg-transparent sm:bg-slate-50 dark:sm:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer touch-target-min"
            aria-label="User Account Profile"
          >
            <div className="text-right hidden md:block pl-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                {currentUser?.fullName}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                {currentUser?.roleName}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block mr-0.5" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 text-xs animate-in fade-in space-y-3.5">
              {/* Logged-In User Profile Card */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0">
                  {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {currentUser?.email}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                      <ShieldCheck className="w-3 h-3" />
                      {currentUser?.roleName}
                    </span>
                    {currentUser?.isDemo ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        Demo Sandbox Profile
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        Corporate User
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* User Profile Details & Isolation Status */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2 text-[11px] border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">User Type:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{currentUser?.roleName}</span>
                </div>
                {currentUser?.department && (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">Department:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentUser.department} {currentUser.employeeId ? `(${currentUser.employeeId})` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Project Scope:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {currentUser?.isAllProjects ? 'All Projects (Unrestricted)' : `${currentUser?.assignedProjectIds?.length || 1} Assigned Project(s)`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Database Engine:</span>
                  <span className="font-medium inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                    <span className={`w-2 h-2 rounded-full ${currentUser?.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {currentUser?.isDemo ? 'Isolated Demo Sandbox' : 'Real Enterprise Database'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Session Status:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active &amp; Authenticated
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Auto-Logout:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>{sessionSecurityService.getTimeoutMinutes()}m idle</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">(60s alert)</span>
                  </span>
                </div>
              </div>

              {/* Quick Trigger to Test 60s Warning Modal */}
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  sessionSecurityService.simulateWarningCountdown(60);
                }}
                className="w-full px-3 py-1.5 rounded-xl text-left flex items-center justify-between text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/80 dark:border-amber-800/60 transition-colors text-xs font-semibold cursor-pointer"
                title="Immediately triggers the 60-second pre-expiration security modal"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Test 60s Warning Modal
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800/70 font-mono">
                  60s
                </span>
              </button>

              {/* Quick Navigation to Settings if authorized */}
              {onNavigateView && (authService.hasPermission('settings.view') || authService.isSuperAdmin()) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigateView('system_config');
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span className="font-medium">System Configuration &amp; Directory</span>
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-slate-400" />
                </button>
              )}

              {/* Log Out Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-semibold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Android Mobile Full-Screen Search Overlay */}
      {isSearchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col animate-in fade-in duration-150">
          {/* Top Search App Bar */}
          <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-2 -ml-1 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 touch-target-min cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-3.5 py-1.5 border border-slate-200/80 dark:border-slate-700/80">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, vendors, clients..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div className="flex items-center gap-2 p-3 overflow-x-auto border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50">
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 touch-target-min ${
                  searchCategory === tab.id
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    searchCategory === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Results List */}
          <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60 pb-20">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                <Search className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No matches for &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try searching with code, title, or contact person
                </p>
              </div>
            ) : (
              filteredResults.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelectItem(item)}
                  className="p-3 rounded-xl flex items-center justify-between gap-3 active:bg-blue-50 dark:active:bg-blue-950/40 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.code} &bull; {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {getTypeBadge(item.type)}
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

