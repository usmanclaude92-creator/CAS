import React, { useState, useEffect } from 'react';
import {
  Layers,
  Building2,
  Users,
  Truck,
  Landmark,
  Coins,
  ShieldCheck,
  Plus,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { authService } from '../../services/authService';
import { formatOMR } from '../../utils/formatters';
import { MasterDataImportModal, MasterImportType } from '../modals/MasterDataImportModal';
import { BatchEntityImportModal } from '../modals/BatchEntityImportModal';
import { NewExpenseCategoryModal } from '../modals/NewExpenseCategoryModal';
import { AddExpenseCategoryModal } from '../modals/AddExpenseCategoryModal';
import { ManageExpenseCategoriesModal } from '../modals/ManageExpenseCategoriesModal';
import { ExpenseHead } from '../../types';

interface MastersViewProps {
  onOpenNewProject: () => void;
  onOpenNewCustomer: () => void;
  onOpenNewVendor: () => void;
  onOpenNewBankAccount: () => void;
  onOpenSupabaseSettings: () => void;
}

export const MastersView: React.FC<MastersViewProps> = ({
  onOpenNewProject,
  onOpenNewCustomer,
  onOpenNewVendor,
  onOpenNewBankAccount,
  onOpenSupabaseSettings,
}) => {
  const [activeMaster, setActiveMaster] = useState<
    'projects' | 'customers' | 'vendors' | 'banks' | 'expense_heads'
  >('projects');
  const [importModalType, setImportModalType] = useState<MasterImportType | null>(null);
  const [batchImportType, setBatchImportType] = useState<'customers' | 'vendors' | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseHead | null>(null);
  const [, setRerender] = useState(0);

  const state = accountingService.getState();
  const currentUser = authService.getCurrentUser();

  // STRICT UI SECURITY REQUIREMENT:
  // Import buttons must NOT be shown to any user except Super Administrator!
  // Do NOT merely disable the buttons. Do NOT render them at all for unauthorized users.
  const canImportMasterData =
    authService.isSuperAdmin() && authService.hasPermission('master_data.import');

  useEffect(() => {
    const unsubAuth = authService.subscribe(() => setRerender((v) => v + 1));
    const unsubAccounting = accountingService.subscribe(() => setRerender((v) => v + 1));
    return () => {
      unsubAuth();
      unsubAccounting();
    };
  }, []);

  const handleResetToSeed = () => {
    if (window.confirm('Reset all demo data and reload standard initial seed data?')) {
      accountingService.resetToSeedData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Business Entity Masters</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Operational Data
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Chart of Accounts, Project Master, Customer Master, Vendor Master, and Expense Heads
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSupabaseSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
          >
            Supabase DB Config
          </button>
          <button
            onClick={handleResetToSeed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Reload Standard Seed
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-xs flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveMaster('projects')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeMaster === 'projects'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Projects ({state.projects.length})
        </button>
        <button
          onClick={() => setActiveMaster('customers')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeMaster === 'customers'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Customers / Clients ({state.customers.length})
        </button>
        <button
          onClick={() => setActiveMaster('vendors')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeMaster === 'vendors'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Vendors / Suppliers ({state.vendors.length})
        </button>
        <button
          onClick={() => setActiveMaster('banks')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeMaster === 'banks'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Bank &amp; Cash Accounts ({state.bankAccounts.length + state.cashAccounts.length + state.pettyCashAccounts.length})
        </button>
        <button
          onClick={() => setActiveMaster('expense_heads')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeMaster === 'expense_heads'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Expense Heads ({state.expenseHeads.length})
        </button>
      </div>

      {/* Content Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* PROJECTS TAB */}
        {activeMaster === 'projects' && (
          <div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Projects Master List</h3>
              <div className="flex items-center gap-2">
                {/* STRICT CHECK: Super Admin only bulk import button */}
                {canImportMasterData && (
                  <button
                    onClick={() => setImportModalType('projects')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Import Projects (Super Admin)</span>
                  </button>
                )}
                <button
                  onClick={onOpenNewProject}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Project
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Project Name</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Contract Value</th>
                    <th className="py-2.5 px-4">Start Date</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">{p.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{p.customerName}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {formatOMR(p.contractValue)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{p.startDate}</td>
                      <td className="py-2.5 px-4 capitalize">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CUSTOMERS TAB */}
        {activeMaster === 'customers' && (
          <div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Customer &amp; Client Master</h3>
              <div className="flex items-center gap-2">
                {/* STRICT CHECK: Super Admin only bulk import buttons */}
                {canImportMasterData && (
                  <>
                    <button
                      onClick={() => setBatchImportType('customers')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Batch CSV Import</span>
                    </button>
                    <button
                      onClick={() => setImportModalType('customers')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Quick JSON/CSV Import</span>
                    </button>
                  </>
                )}
                <button
                  onClick={onOpenNewCustomer}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Customer
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Customer Name</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4">Phone / Email</th>
                    <th className="py-2.5 px-4 text-right">Opening Balance</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">{c.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{c.contactPerson || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{c.phone || c.email || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-800 dark:text-slate-200">{formatOMR(c.openingBalance)}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VENDORS TAB */}
        {activeMaster === 'vendors' && (
          <div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Vendor &amp; Subcontractor Master</h3>
              <div className="flex items-center gap-2">
                {/* STRICT CHECK: Super Admin only bulk import buttons */}
                {canImportMasterData && (
                  <>
                    <button
                      onClick={() => setBatchImportType('vendors')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Batch CSV Import</span>
                    </button>
                    <button
                      onClick={() => setImportModalType('vendors')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Quick JSON/CSV Import</span>
                    </button>
                  </>
                )}
                <button
                  onClick={onOpenNewVendor}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Vendor
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Vendor Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4 text-right">Opening Balance</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">{v.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{v.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {v.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{v.contactPerson || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-800 dark:text-slate-200">{formatOMR(v.openingBalance)}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BANK ACCOUNTS TAB */}
        {activeMaster === 'banks' && (
          <div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Commercial Bank Accounts</h3>
              <div className="flex items-center gap-2">
                {canImportMasterData && (
                  <button
                    onClick={() => setImportModalType('banks')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Import Banks (Super Admin)</span>
                  </button>
                )}
                <button
                  onClick={onOpenNewBankAccount}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Bank Account
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Bank Name</th>
                    <th className="py-2.5 px-4">Account Label</th>
                    <th className="py-2.5 px-4">Account Number</th>
                    <th className="py-2.5 px-4">IBAN</th>
                    <th className="py-2.5 px-4 text-right">Opening Balance</th>
                    <th className="py-2.5 px-4 text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.bankAccounts.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{b.bankName}</td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{b.accountName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{b.accountNumber}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 text-[10px]">{b.iban || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">{formatOMR(b.openingBalance)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatOMR(b.currentBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXPENSE HEADS TAB */}
        {activeMaster === 'expense_heads' && (
          <div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  Direct Expense Heads &amp; Cost Categories ({state.expenseHeads.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard classifications for site vouchers, equipment hires, labor, and job overheads
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-masters-edit-categories"
                  onClick={() => setIsManageCategoriesModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 cursor-pointer shadow-xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  <span>Edit / Manage Categories</span>
                </button>
                <button
                  type="button"
                  id="btn-masters-add-category"
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-rose-700 hover:bg-rose-600 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Expense Category</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Expense Head Name</th>
                    <th className="py-2.5 px-4">Cost Classification Group</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Linked Vouchers</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.expenseHeads.map((h) => {
                    const linkedCount = state.directExpenses.filter((e) => e.expenseHeadId === h.id).length;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {h.name}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {h.category || 'Direct Project Cost'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {h.description || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {linkedCount} vouchers
                        </td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            title="Click to toggle active/inactive status"
                            onClick={() => {
                              try {
                                accountingService.updateExpenseHead(h.id, {
                                  status: h.status === 'active' ? 'inactive' : 'active',
                                });
                                setRerender((v) => v + 1);
                              } catch (err: any) {
                                alert(err?.message || 'Failed to update category status.');
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                              h.status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {h.status === 'active' ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              title="Edit Expense Category"
                              onClick={() => {
                                setEditingCategory(h);
                                setIsCategoryModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title={
                                linkedCount > 0
                                  ? 'Cannot delete: vouchers are recorded under this category'
                                  : 'Delete Expense Category'
                              }
                              disabled={linkedCount > 0}
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete expense category "${h.name}"?`)) {
                                  try {
                                    accountingService.deleteExpenseHead(h.id);
                                    setRerender((v) => v + 1);
                                  } catch (err: any) {
                                    alert(err?.message || 'Failed to delete category.');
                                  }
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Expense Category Management Modal */}
      {isManageCategoriesModalOpen && (
        <ManageExpenseCategoriesModal
          isOpen={isManageCategoriesModalOpen}
          onClose={() => setIsManageCategoriesModalOpen(false)}
          onOpenAddModal={() => {
            setIsManageCategoriesModalOpen(false);
            setIsAddCategoryModalOpen(true);
          }}
        />
      )}

      {/* Add Expense Category Modal with Supabase update */}
      {isAddCategoryModalOpen && (
        <AddExpenseCategoryModal
          isOpen={isAddCategoryModalOpen}
          onClose={() => setIsAddCategoryModalOpen(false)}
          onSuccess={() => {
            setIsAddCategoryModalOpen(false);
            setRerender((v) => v + 1);
          }}
        />
      )}

      {/* Legacy/Inline Expense Category Modal */}
      {isCategoryModalOpen && (
        <NewExpenseCategoryModal
          isOpen={isCategoryModalOpen}
          editCategory={editingCategory}
          onClose={() => {
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
          }}
          onSuccess={() => {
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
            setRerender((v) => v + 1);
          }}
        />
      )}

      {/* Super Administrator Bulk Import Modal */}
      {importModalType && (
        <MasterDataImportModal
          isOpen={Boolean(importModalType)}
          importType={importModalType}
          onClose={() => setImportModalType(null)}
          onSuccess={() => {
            setRerender((v) => v + 1);
          }}
        />
      )}

      {/* Batch Entity CSV Import & Validation Modal */}
      {batchImportType && (
        <BatchEntityImportModal
          isOpen={Boolean(batchImportType)}
          defaultType={batchImportType}
          onClose={() => setBatchImportType(null)}
          onImportComplete={() => {
            setRerender((v) => v + 1);
          }}
        />
      )}
    </div>
  );
};

export default MastersView;
