import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  AlertCircle,
  ShieldAlert,
  Send,
  Building2,
  Calendar,
  DollarSign,
  User,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { Transaction, TransactionType } from '../../types';
import { authService } from '../../services/authService';
import { workflowService } from '../../services/workflowService';
import { accountingService } from '../../services/accountingService';
import { RejectReasonModal } from '../modals/RejectReasonModal';

export const ApprovalsView: React.FC = () => {
  const [pendingList, setPendingList] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reject Modal state
  const [rejectTxn, setRejectTxn] = useState<Transaction | null>(null);

  const currentUser = authService.getCurrentUser();
  const projects = accountingService.getState().projects;
  const accessibleProjects = authService.filterAccessibleProjects(projects);

  const refreshList = () => {
    const list = workflowService.getPendingApprovals();
    setPendingList(list);
  };

  useEffect(() => {
    refreshList();
    const unsub = authService.subscribe(refreshList);
    return () => unsub();
  }, []);

  const handleApprove = (txn: Transaction) => {
    setActionAlert(null);
    const result = workflowService.approveTransaction(txn.id, txn.type);
    if (result.success) {
      setActionAlert({
        type: 'success',
        message: result.message || `Transaction ${txn.documentRef} approved.`,
      });
      refreshList();
    } else {
      setActionAlert({
        type: 'error',
        message: result.error || 'Approval failed.',
      });
    }
  };

  const handleConfirmReject = (reason: string) => {
    if (!rejectTxn) return;
    const result = workflowService.rejectTransaction(rejectTxn.id, rejectTxn.type, reason);
    setRejectTxn(null);
    if (result.success) {
      setActionAlert({
        type: 'success',
        message: result.message || 'Transaction rejected and returned to draft.',
      });
      refreshList();
    } else {
      setActionAlert({
        type: 'error',
        message: result.error || 'Rejection failed.',
      });
    }
  };

  const handlePost = (txn: Transaction) => {
    setActionAlert(null);
    const result = workflowService.postTransaction(txn.id, txn.type);
    if (result.success) {
      setActionAlert({
        type: 'success',
        message: result.message || `Transaction ${txn.documentRef} posted to General Ledger.`,
      });
      refreshList();
    } else {
      setActionAlert({
        type: 'error',
        message: result.error || 'Post failed.',
      });
    }
  };

  // Filter transactions
  const filtered = pendingList.filter((t) => {
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    if (filterProject !== 'ALL' && t.projectId !== filterProject) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-500" />
            <span>Pending Approvals &amp; Governance Queue</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enforces strict Separation of Duties (SOD), role limits, and project-scoped audit authorization.
          </p>
        </div>

        {/* Current user limits badge */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs text-xs">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">{currentUser?.fullName}</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              Role: <strong className="text-blue-600 dark:text-blue-400">{currentUser?.roleName}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Action Banner (Feedback) */}
      {actionAlert && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in ${
            actionAlert.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {actionAlert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <div>
            <strong className="font-semibold block">{actionAlert.type === 'success' ? 'Action Completed' : 'Authorization Restriction'}</strong>
            <p className="mt-0.5">{actionAlert.message}</p>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Filter By:</span>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Transaction Types</option>
          <option value="CLIENT_INVOICE">Client Invoices / IPC</option>
          <option value="PURCHASE">Purchases / Bills</option>
          <option value="MONEY_IN">Money In / Receipts</option>
          <option value="MONEY_OUT">Money Out / Payments</option>
          <option value="EXPENSE">Direct Site Expenses</option>
          <option value="TRANSFER">Bank / Cash Transfers</option>
        </select>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Authorized Projects</option>
          {accessibleProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>

        <div className="ml-auto text-slate-500 dark:text-slate-400">
          Showing <strong>{filtered.length}</strong> submitted item(s) awaiting approval
        </div>
      </div>

      {/* Pending Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Caught Up!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              There are no pending approvals matching your current role permissions and project scope.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Ref #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Project / Party</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount (OMR)</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((txn) => {
                  const isCreator = (txn.createdBy || txn.submittedBy) === currentUser?.id;
                  const sodConflict = authService.getWorkflowSettings().separationOfDutiesEnabled && isCreator;

                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {txn.date}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {txn.documentRef}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {txn.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {txn.projectName || 'Global Company Account'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {txn.customerName || txn.vendorName || txn.accountName || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {txn.description}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        OMR {txn.amount.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-900 dark:text-white font-medium">
                          {txn.createdByName || txn.submittedBy || 'System'}
                        </div>
                        {sodConflict && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                            <ShieldAlert className="w-3 h-3" /> SOD Conflict (Own Txn)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Approve Button */}
                          <button
                            type="button"
                            onClick={() => handleApprove(txn)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs ${
                              sodConflict
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title={
                              sodConflict
                                ? 'Separation of Duties (SOD): Creator cannot approve own transaction.'
                                : 'Approve Transaction'
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          {/* Reject Button */}
                          <button
                            type="button"
                            onClick={() => setRejectTxn(txn)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Reject Transaction with mandatory reason"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal with Mandatory Reason */}
      {rejectTxn && (
        <RejectReasonModal
          isOpen={Boolean(rejectTxn)}
          documentRef={rejectTxn.documentRef}
          onClose={() => setRejectTxn(null)}
          onConfirm={handleConfirmReject}
        />
      )}
    </div>
  );
};

export default ApprovalsView;
