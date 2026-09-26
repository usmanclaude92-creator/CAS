import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  FileSpreadsheet,
  ArrowLeft,
  Receipt,
  Mail,
  Phone,
  Search,
  X,
  Calendar,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';

interface PurchasesViewProps {
  selectedVendorId?: string | null;
  onClearSelectedVendor: () => void;
  onSelectVendor: (id: string) => void;
  onOpenNewVendor: () => void;
  onOpenPurchase: () => void;
  onOpenMoneyOut: () => void;
  onSelectProject?: (id: string) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  selectedVendorId,
  onClearSelectedVendor,
  onSelectVendor,
  onOpenNewVendor,
  onOpenPurchase,
  onOpenMoneyOut,
  onSelectProject,
}) => {
  const [, setVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'bills' | 'vendors'>('bills');

  // Filter states for Purchase Bills
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedVendorFilterId, setSelectedVendorFilterId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');

  // Filter states for Master Vendors Directory
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Filter states for Individual Vendor Statement
  const [statementSearch, setStatementSearch] = useState('');
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementProjectId, setStatementProjectId] = useState('all');
  const [statementTypeFilter, setStatementTypeFilter] = useState('all');

  // Subscribe to real-time updates from accounting engine
  useEffect(() => {
    const unsubscribe = accountingService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const state = accountingService.getState();

  const selectedVendor = selectedVendorId
    ? state.vendors.find((v) => v.id === selectedVendorId)
    : null;

  const rawVendorLedger = selectedVendor
    ? accountingService.getVendorLedger(selectedVendor.id)
    : [];

  const currentPayable = rawVendorLedger.length > 0
    ? rawVendorLedger[rawVendorLedger.length - 1].outstanding
    : selectedVendor?.openingBalance || 0;

  // Filtered vendor ledger entries for single vendor statement
  const filteredVendorLedger = useMemo(() => {
    if (!selectedVendor) return [];
    return rawVendorLedger.filter((row) => {
      if (statementStartDate && row.date < statementStartDate) return false;
      if (statementEndDate && row.date > statementEndDate) return false;
      if (statementProjectId !== 'all' && row.projectId && row.projectId !== statementProjectId) {
        return false;
      }
      if (statementTypeFilter !== 'all') {
        if (statementTypeFilter === 'PURCHASE' && row.type !== 'PURCHASE') return false;
        if (statementTypeFilter === 'PAYMENT' && row.type !== 'PAYMENT') return false;
        if (statementTypeFilter === 'OPENING_BALANCE' && row.type !== 'OPENING_BALANCE') return false;
      }
      if (statementSearch.trim()) {
        const q = statementSearch.toLowerCase();
        const matchesDoc = (row.documentRef || '').toLowerCase().includes(q);
        const matchesDesc = (row.description || '').toLowerCase().includes(q);
        const matchesProj = (row.projectName || '').toLowerCase().includes(q);
        const matchesType = (row.type || '').toLowerCase().includes(q);
        if (!matchesDoc && !matchesDesc && !matchesProj && !matchesType) return false;
      }
      return true;
    });
  }, [
    selectedVendor,
    rawVendorLedger,
    statementStartDate,
    statementEndDate,
    statementProjectId,
    statementTypeFilter,
    statementSearch,
  ]);

  const statementFilteredPurchases = filteredVendorLedger.reduce((acc, r) => acc + r.purchased, 0);
  const statementFilteredPayments = filteredVendorLedger.reduce((acc, r) => acc + r.paid, 0);

  const activeStatementFiltersCount = [
    statementSearch.trim() !== '',
    statementStartDate !== '',
    statementEndDate !== '',
    statementProjectId !== 'all',
    statementTypeFilter !== 'all',
  ].filter(Boolean).length;

  const handleResetStatementFilters = () => {
    setStatementSearch('');
    setStatementStartDate('');
    setStatementEndDate('');
    setStatementProjectId('all');
    setStatementTypeFilter('all');
  };

  // Filtered purchases across all vendors
  const filteredPurchases = useMemo(() => {
    return (state.purchases || []).filter((p) => {
      // Date range filter
      if (startDate && p.date < startDate) return false;
      if (endDate && p.date > endDate) return false;

      // Project filter
      if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) return false;

      // Vendor filter
      if (selectedVendorFilterId !== 'all' && p.vendorId !== selectedVendorFilterId) return false;

      // Payment status filter
      if (statusFilter !== 'all') {
        const isPaid = (p.outstandingAmount || 0) <= 0.001;
        const isPartial = (p.paidAmount || 0) > 0.001 && (p.outstandingAmount || 0) > 0.001;
        const isUnpaid = (p.paidAmount || 0) <= 0.001 && (p.outstandingAmount || 0) > 0.001;

        if (statusFilter === 'paid' && !isPaid) return false;
        if (statusFilter === 'partial' && !isPartial) return false;
        if (statusFilter === 'unpaid' && !isUnpaid) return false;
      }

      // Keyword text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchVendor = (p.vendorName || '').toLowerCase().includes(q);
        const matchProject = (p.projectName || '').toLowerCase().includes(q);
        const matchDoc = (p.documentRef || '').toLowerCase().includes(q);
        const matchInvoice = (p.purchaseInvoiceNumber || '').toLowerCase().includes(q);
        const matchCat = (p.purchaseCategory || '').toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const matchRemarks = (p.remarks || '').toLowerCase().includes(q);

        if (
          !matchVendor &&
          !matchProject &&
          !matchDoc &&
          !matchInvoice &&
          !matchCat &&
          !matchDesc &&
          !matchRemarks
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    state.purchases,
    startDate,
    endDate,
    selectedProjectId,
    selectedVendorFilterId,
    statusFilter,
    searchQuery,
  ]);

  const totalFilteredPurchases = filteredPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalFilteredPaid = filteredPurchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const totalFilteredOutstanding = filteredPurchases.reduce(
    (acc, p) => acc + (p.outstandingAmount || 0),
    0
  );

  const activeBillFiltersCount = [
    searchQuery.trim() !== '',
    startDate !== '',
    endDate !== '',
    selectedProjectId !== 'all',
    selectedVendorFilterId !== 'all',
    statusFilter !== 'all',
  ].filter(Boolean).length;

  const handleResetBillFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedProjectId('all');
    setSelectedVendorFilterId('all');
    setStatusFilter('all');
  };

  // Filtered vendors list
  const filteredVendors = useMemo(() => {
    return state.vendors.filter((v) => {
      if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;

      if (vendorSearchQuery.trim()) {
        const q = vendorSearchQuery.toLowerCase();
        const matchCode = (v.code || '').toLowerCase().includes(q);
        const matchName = (v.name || '').toLowerCase().includes(q);
        const matchContact = (v.contactPerson || '').toLowerCase().includes(q);
        const matchPhone = (v.phone || '').toLowerCase().includes(q);
        const matchEmail = (v.email || '').toLowerCase().includes(q);
        const matchCategory = (v.category || '').toLowerCase().includes(q);

        if (!matchCode && !matchName && !matchContact && !matchPhone && !matchEmail && !matchCategory) {
          return false;
        }
      }

      return true;
    });
  }, [state.vendors, selectedCategory, vendorSearchQuery]);

  const vendorCategories = useMemo(() => {
    return Array.from(new Set(state.vendors.map((v) => v.category).filter(Boolean)));
  }, [state.vendors]);

  const handleExportVendorStatement = () => {
    if (!selectedVendor) return;

    const data = filteredVendorLedger.map((row) => ({
      Date: row.date,
      'Doc Ref': row.documentRef,
      Type: row.type.replace('_', ' '),
      Project: row.projectName || '—',
      Description: row.description,
      'Purchase Credit (OMR)': row.purchased > 0 ? row.purchased : '',
      'Payment Debit (OMR)': row.paid > 0 ? row.paid : '',
      'Payable Balance (OMR)': row.outstanding,
    }));

    exportToExcel({
      filename: `Vendor_Statement_${selectedVendor.code}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Vendor Statement',
      title: `VENDOR STATEMENT OF ACCOUNT — ${selectedVendor.name.toUpperCase()}`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  const handleExportBills = () => {
    const data = filteredPurchases.map((p) => ({
      'Invoice Date': p.date,
      'Bill Ref': p.purchaseInvoiceNumber || p.documentRef,
      'Vendor Name': p.vendorName,
      Project: p.projectName,
      Category: p.purchaseCategory,
      Description: p.description,
      'Bill Amount (OMR)': p.amount,
      'Paid Amount (OMR)': p.paidAmount || 0,
      'Balance Due (OMR)': p.outstandingAmount || 0,
      Status:
        p.outstandingAmount <= 0.001
          ? 'PAID'
          : p.paidAmount > 0.001
          ? 'PARTIALLY PAID'
          : 'UNPAID',
      Remarks: p.remarks || '—',
    }));

    exportToExcel({
      filename: `Purchase_Bills_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Purchase Bills',
      title: 'PURCHASE BILLS & MATERIAL PROCUREMENT REGISTER',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  const handleExportAllVendors = () => {
    const data = filteredVendors.map((v) => {
      const ledger = accountingService.getVendorLedger(v.id);
      const outstanding =
        ledger.length > 0 ? ledger[ledger.length - 1].outstanding : v.openingBalance;
      const totalPurchased = ledger.reduce((acc, row) => acc + row.purchased, 0);
      const totalPaid = ledger.reduce((acc, row) => acc + row.paid, 0);

      return {
        'Vendor Code': v.code,
        'Vendor Name': v.name,
        Category: v.category,
        'Contact Person': v.contactPerson || '—',
        Phone: v.phone || '—',
        'Opening Balance (OMR)': v.openingBalance,
        'Total Purchases (OMR)': totalPurchased,
        'Total Paid (OMR)': totalPaid,
        'Current Payable (OMR)': outstanding,
      };
    });

    exportToExcel({
      filename: `Vendors_Payables_Summary_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Payables',
      title: 'ACCOUNTS PAYABLE MASTER SUMMARY REPORT',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  // =========================================================================
  // VIEW: SINGLE VENDOR STATEMENT OF ACCOUNT
  // =========================================================================
  if (selectedVendor) {
    return (
      <div className="container-responsive space-y-6">
        {/* Navigation & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClearSelectedVendor}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer touch-target-min"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Purchases &amp; Vendors
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenPurchase}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg text-white bg-amber-700 hover:bg-amber-600 cursor-pointer shadow-xs transition-colors touch-target-min"
            >
              <Plus className="w-3.5 h-3.5" />
              + Record Purchase Bill
            </button>
            <button
              onClick={onOpenMoneyOut}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs transition-colors touch-target-min"
            >
              <Plus className="w-3.5 h-3.5" />
              + Settle Payment
            </button>
            <button
              onClick={handleExportVendorStatement}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-xs transition-colors touch-target-min"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Statement (Excel)
            </button>
          </div>
        </div>

        {/* Vendor Detail Master Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {selectedVendor.code}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Category: {selectedVendor.category}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">{selectedVendor.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                {selectedVendor.contactPerson && (
                  <span>
                    Contact: <strong>{selectedVendor.contactPerson}</strong>
                  </span>
                )}
                {selectedVendor.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedVendor.phone}
                  </span>
                )}
                {selectedVendor.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selectedVendor.email}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-right min-w-[200px]">
              <span className="text-xs text-amber-700 font-medium uppercase tracking-wider">
                Current Payable to Vendor
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                {formatOMR(currentPayable)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Opening Balance: {formatOMR(selectedVendor.openingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Statement Search & Filter Controls */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Vendor Statement of Account &amp; Running Balance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredVendorLedger.length} of {rawVendorLedger.length} transactions
                  {activeStatementFiltersCount > 0 && (
                    <span className="ml-2 font-medium text-amber-700">
                      (Filtered Purchases: {formatOMR(statementFilteredPurchases)} | Filtered Paid: {formatOMR(statementFilteredPayments)})
                    </span>
                  )}
                </p>
              </div>

              {activeStatementFiltersCount > 0 && (
                <button
                  onClick={handleResetStatementFilters}
                  className="self-start lg:self-auto inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Filters ({activeStatementFiltersCount})
                </button>
              )}
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
              {/* Search text input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={statementSearch}
                  onChange={(e) => setStatementSearch(e.target.value)}
                  placeholder="Search doc ref, description..."
                  className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                {statementSearch && (
                  <button
                    onClick={() => setStatementSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Date Range: Start Date */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] uppercase font-semibold text-slate-400 shrink-0">From:</span>
                <input
                  type="date"
                  value={statementStartDate}
                  onChange={(e) => setStatementStartDate(e.target.value)}
                  className="w-full text-xs text-slate-700 focus:outline-none bg-transparent cursor-pointer"
                />
                {statementStartDate && (
                  <button
                    onClick={() => setStatementStartDate('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Date Range: End Date */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] uppercase font-semibold text-slate-400 shrink-0">To:</span>
                <input
                  type="date"
                  value={statementEndDate}
                  onChange={(e) => setStatementEndDate(e.target.value)}
                  className="w-full text-xs text-slate-700 focus:outline-none bg-transparent cursor-pointer"
                />
                {statementEndDate && (
                  <button
                    onClick={() => setStatementEndDate('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Project Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={statementProjectId}
                  onChange={(e) => setStatementProjectId(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">-- All Projects --</option>
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>

                <select
                  value={statementTypeFilter}
                  onChange={(e) => setStatementTypeFilter(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">-- All Types --</option>
                  <option value="PURCHASE">Bills (Cr)</option>
                  <option value="PAYMENT">Payments (Dr)</option>
                  <option value="OPENING_BALANCE">Opening</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="table-responsive-container">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Doc Ref</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Bill Amount (Cr)</th>
                  <th className="py-3 px-4 text-right">Payment Paid (Dr)</th>
                  <th className="py-3 px-4 text-right">Payable Balance (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendorLedger.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.documentRef}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.type === 'OPENING_BALANCE'
                            ? 'bg-slate-100 text-slate-700'
                            : row.type === 'PURCHASE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {row.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {row.projectName || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={row.description}>
                      {row.description}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                      {row.purchased > 0 ? formatOMR(row.purchased) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                      {row.paid > 0 ? formatOMR(row.paid) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(row.outstanding)}
                    </td>
                  </tr>
                ))}
                {filteredVendorLedger.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Filter className="w-5 h-5 text-slate-300" />
                        <span>No transactions match the selected statement filters.</span>
                        {activeStatementFiltersCount > 0 && (
                          <button
                            onClick={handleResetStatementFilters}
                            className="mt-1 text-xs text-amber-700 font-semibold hover:underline"
                          >
                            Reset filters to view all entries
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN PURCHASES DASHBOARD (TABS: PURCHASE BILLS & VENDOR DIRECTORY)
  // =========================================================================
  return (
    <div className="container-responsive space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Purchases &amp; Accounts Payable</h2>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-3 px-3 text-xs font-semibold inline-flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'bills'
              ? 'border-amber-700 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Purchase Bills &amp; Transactions</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'bills'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredPurchases.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 px-3 text-xs font-semibold inline-flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'vendors'
              ? 'border-amber-700 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Vendors &amp; Suppliers Directory</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'vendors'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredVendors.length}
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PURCHASE BILLS & TRANSACTIONS TABLE WITH FILTERS              */}
      {/* ===================================================================== */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar for Filtered Transactions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Total Purchases (Cr)
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatOMR(totalFilteredPurchases)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Total Paid (Dr)
                </span>
                <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
                  {formatOMR(totalFilteredPaid)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Outstanding Due
                </span>
                <span className="text-lg font-bold font-mono text-amber-800 mt-0.5 block">
                  {formatOMR(totalFilteredOutstanding)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Filter Purchase Transactions
                  </span>
                  <span className="text-xs text-slate-500">
                    ({filteredPurchases.length} of {state.purchases?.length || 0} Bills)
                  </span>
                </div>

                {activeBillFiltersCount > 0 && (
                  <button
                    onClick={handleResetBillFilters}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear Filters ({activeBillFiltersCount})
                  </button>
                )}
              </div>

              {/* Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 mt-3">
                {/* 1. Keyword Search Input */}
                <div className="lg:col-span-4 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search vendor, project, bill #, description..."
                    className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* 2. Date Range: Start Date */}
                <div className="lg:col-span-2 flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs text-slate-700 focus:outline-none bg-transparent cursor-pointer"
                  />
                  {startDate && (
                    <button onClick={() => setStartDate('')} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* 3. Date Range: End Date */}
                <div className="lg:col-span-2 flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs text-slate-700 focus:outline-none bg-transparent cursor-pointer"
                  />
                  {endDate && (
                    <button onClick={() => setEndDate('')} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* 4. Project Filter Dropdown */}
                <div className="lg:col-span-2">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer truncate"
                  >
                    <option value="all">-- All Projects --</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Vendor Filter Dropdown */}
                <div className="lg:col-span-2">
                  <select
                    value={selectedVendorFilterId}
                    onChange={(e) => setSelectedVendorFilterId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer truncate"
                  >
                    <option value="all">-- All Vendors --</option>
                    {state.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Quick Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Payment Status:</span>
                {(
                  [
                    { id: 'all', label: 'All Bills' },
                    { id: 'unpaid', label: 'Unpaid' },
                    { id: 'partial', label: 'Partially Paid' },
                    { id: 'paid', label: 'Fully Paid' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${
                      statusFilter === st.id
                        ? 'bg-amber-800 text-white font-semibold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table of Purchase Transactions */}
            <div className="table-responsive-container">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Bill Ref</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Bill (Cr)</th>
                    <th className="py-3 px-4 text-right">Paid (Dr)</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchases.map((p) => {
                    const isPaid = (p.outstandingAmount || 0) <= 0.001;
                    const isPartial = (p.paidAmount || 0) > 0.001 && (p.outstandingAmount || 0) > 0.001;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{p.date}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {p.purchaseInvoiceNumber || p.documentRef}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            onClick={() => onSelectVendor(p.vendorId)}
                            className="font-medium text-slate-900 hover:text-amber-700 hover:underline text-left cursor-pointer flex items-center gap-1"
                            title="View Vendor Statement"
                          >
                            <span>{p.vendorName}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {onSelectProject ? (
                            <button
                              onClick={() => onSelectProject(p.projectId)}
                              className="text-slate-700 hover:text-blue-600 hover:underline cursor-pointer"
                            >
                              {p.projectName}
                            </button>
                          ) : (
                            p.projectName
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                            {p.purchaseCategory || 'Materials'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={p.description}>
                          {p.description}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                          {formatOMR(p.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700 whitespace-nowrap">
                          {p.paidAmount ? formatOMR(p.paidAmount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap text-slate-900">
                          {formatOMR(p.outstandingAmount || 0)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {!isPaid && (
                              <button
                                onClick={onOpenMoneyOut}
                                className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition-colors"
                              >
                                Settle
                              </button>
                            )}
                            <button
                              onClick={() => onSelectVendor(p.vendorId)}
                              className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer transition-colors"
                              title="View Vendor Statement"
                            >
                              Statement
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Receipt className="w-7 h-7 text-slate-300" />
                          <span className="font-medium text-slate-600">
                            No purchase transactions match your search or filter criteria.
                          </span>
                          {activeBillFiltersCount > 0 && (
                            <button
                              onClick={handleResetBillFilters}
                              className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer mt-1"
                            >
                              Reset filters to show all {state.purchases?.length || 0} purchase bills
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: VENDORS & SUPPLIERS DIRECTORY TABLE WITH FILTERS               */}
      {/* ===================================================================== */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          {/* Vendors Search & Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 max-w-md relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={vendorSearchQuery}
                  onChange={(e) => setVendorSearchQuery(e.target.value)}
                  placeholder="Search vendor name, code, contact person, phone..."
                  className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                {vendorSearchQuery && (
                  <button
                    onClick={() => setVendorSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">-- All Categories --</option>
                  {vendorCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {(vendorSearchQuery || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setVendorSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Vendors Table */}
            <div className="table-responsive-container">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Vendor Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4 text-right">Opening Balance</th>
                    <th className="py-3 px-4 text-right">Total Purchases</th>
                    <th className="py-3 px-4 text-right">Total Paid</th>
                    <th className="py-3 px-4 text-right">Current Payable</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVendors.map((v) => {
                    const ledger = accountingService.getVendorLedger(v.id);
                    const outstanding =
                      ledger.length > 0 ? ledger[ledger.length - 1].outstanding : v.openingBalance;
                    const totalPurchased = ledger.reduce((acc, row) => acc + row.purchased, 0);
                    const totalPaid = ledger.reduce((acc, row) => acc + row.paid, 0);

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">{v.code}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onSelectVendor(v.id)}
                            className="font-semibold text-slate-900 hover:text-amber-700 text-left cursor-pointer"
                          >
                            {v.name}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {v.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {v.phone || v.email ? (
                            <div className="text-[11px]">
                              <div>{v.contactPerson}</div>
                              <div className="text-slate-400">{v.phone || v.email}</div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatOMR(v.openingBalance)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                          {formatOMR(totalPurchased)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700">
                          {formatOMR(totalPaid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          {formatOMR(outstanding)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onSelectVendor(v.id)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                          >
                            Statement
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVendors.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400">
                        No vendors match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesView;
