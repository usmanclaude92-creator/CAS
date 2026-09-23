import { Transaction, TransactionType } from '../types';
import { accountingService } from './accountingService';
import { authService } from './authService';
import { notificationService } from './notificationService';
import { notificationCenter } from './notificationCenter';

export interface WorkflowActionResult {
  success: boolean;
  message?: string;
  error?: string;
  updatedTransaction?: Transaction;
}

type RpcModule = 'invoices' | 'purchases' | 'money_in' | 'money_out' | 'expenses';

export function moduleForTransactionType(type: TransactionType): RpcModule | null {
  switch (type) {
    case 'CLIENT_INVOICE':
      return 'invoices';
    case 'PURCHASE':
      return 'purchases';
    case 'MONEY_IN':
      return 'money_in';
    case 'MONEY_OUT':
      return 'money_out';
    case 'EXPENSE':
      return 'expenses';
    default:
      return null; // transfers have no submit/approve/reject/post workflow
  }
}

class WorkflowService {
  /**
   * Submit transaction for approval (Draft -> Submitted).
   * The transition_transaction() Postgres RPC is the authoritative enforcement
   * of permission and state-machine rules; the checks here are a fast client-
   * side pre-flight only.
   */
  public async submitTransaction(transactionId: string, transactionType: TransactionType): Promise<WorkflowActionResult> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.status !== 'active') {
      return { success: false, error: 'Unauthorized: Active user session required.' };
    }

    const allTxns = accountingService.getAllTransactions();
    const txn = allTxns.find((t) => t.id === transactionId);
    if (!txn) {
      return { success: false, error: 'Transaction not found.' };
    }
    if (txn.status !== 'draft' && txn.status !== 'rejected') {
      return { success: false, error: `Cannot submit transaction currently in '${txn.status}' state.` };
    }
    if (!authService.canAccessProject(txn.projectId)) {
      return { success: false, error: 'Access denied: You are not authorized for this project.' };
    }

    const module = moduleForTransactionType(transactionType);
    if (!module) {
      return { success: false, error: `${transactionType} transactions do not go through an approval workflow.` };
    }

    try {
      await accountingService.transitionTransaction(module, txn.id, 'submit');
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to submit transaction.' };
    }

    txn.status = 'submitted';
    txn.submittedBy = currentUser.id;
    txn.submittedAt = new Date().toISOString();

    notificationService.notifyPendingApproval(txn, currentUser.fullName);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} successfully submitted for managerial approval.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Approve transaction (Submitted -> Approved).
   * Separation of Duties and Role Approval Limits are enforced server-side
   * by the transition_transaction() RPC.
   */
  public async approveTransaction(transactionId: string, transactionType: TransactionType): Promise<WorkflowActionResult> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.status !== 'active') {
      return { success: false, error: 'Unauthorized: Active user session required.' };
    }

    const allTxns = accountingService.getAllTransactions();
    const txn = allTxns.find((t) => t.id === transactionId);
    if (!txn) {
      return { success: false, error: 'Transaction not found.' };
    }
    if (txn.status !== 'submitted') {
      return { success: false, error: `Transaction cannot be approved from '${txn.status}' status. Must be 'submitted'.` };
    }
    if (!authService.canAccessProject(txn.projectId)) {
      notificationCenter.unauthorized('Project Scope Access', 'Access denied: You are not authorized for this project.');
      return { success: false, error: 'Access denied: You are not authorized for this project.' };
    }

    const creatorId = txn.createdBy || txn.submittedBy;
    const check = authService.canApproveTransaction(txn.amount, creatorId);
    if (!check.allowed) {
      notificationCenter.unauthorized('Approval Policy Violation', check.reason || 'Approval denied due to security policy.');
      return { success: false, error: check.reason || 'Approval denied due to security policy.' };
    }

    const module = moduleForTransactionType(transactionType);
    if (!module) {
      return { success: false, error: `${transactionType} transactions do not go through an approval workflow.` };
    }

    try {
      await accountingService.transitionTransaction(module, txn.id, 'approve');
    } catch (e: any) {
      notificationCenter.unauthorized('Approval Rejected by Server', e?.message || 'Approval denied.');
      return { success: false, error: e?.message || 'Failed to approve transaction.' };
    }

    txn.status = 'approved';
    txn.approvedBy = currentUser.id;
    txn.approvedByName = currentUser.fullName;
    txn.approvedAt = new Date().toISOString();

    notificationService.notifyStatusChange(txn, 'submitted', 'approved', currentUser.fullName);
    notificationCenter.workflowAction('approved', txn.documentRef, `Approved by ${currentUser.fullName}. Ready to post.`);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} successfully approved. Ready to post.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Reject transaction (Submitted -> Rejected). Requires mandatory rejection reason.
   */
  public async rejectTransaction(transactionId: string, transactionType: TransactionType, reason: string): Promise<WorkflowActionResult> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.status !== 'active') {
      return { success: false, error: 'Unauthorized: Active user session required.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'A valid rejection reason (minimum 5 characters) is mandatory.' };
    }

    const allTxns = accountingService.getAllTransactions();
    const txn = allTxns.find((t) => t.id === transactionId);
    if (!txn) {
      return { success: false, error: 'Transaction not found.' };
    }
    if (txn.status !== 'submitted') {
      return { success: false, error: `Transaction cannot be rejected from '${txn.status}' status.` };
    }
    if (!authService.hasPermission('approvals.reject') && !authService.isSuperAdmin() && !authService.isAccountsManager()) {
      notificationCenter.unauthorized('Privilege Check', 'Missing required privilege: approvals.reject');
      return { success: false, error: 'Missing required privilege: approvals.reject' };
    }

    const module = moduleForTransactionType(transactionType);
    if (!module) {
      return { success: false, error: `${transactionType} transactions do not go through an approval workflow.` };
    }

    try {
      await accountingService.transitionTransaction(module, txn.id, 'reject', reason.trim());
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to reject transaction.' };
    }

    txn.status = 'rejected';
    txn.rejectionReason = reason.trim();

    notificationService.notifyStatusChange(txn, 'submitted', 'rejected', currentUser.fullName, reason.trim());
    notificationCenter.workflowAction('rejected', txn.documentRef, `Rejected by ${currentUser.fullName}. Reason: ${reason.trim()}`);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} rejected. Reason logged in audit trail.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Post approved transaction into general ledger (Approved -> Posted)
   */
  public async postTransaction(transactionId: string, transactionType: TransactionType): Promise<WorkflowActionResult> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.status !== 'active') {
      notificationCenter.unauthorized('Ledger Posting', 'Active user session required.');
      return { success: false, error: 'Unauthorized: Active user session required.' };
    }

    const allTxns = accountingService.getAllTransactions();
    const txn = allTxns.find((t) => t.id === transactionId);
    if (!txn) {
      return { success: false, error: 'Transaction not found.' };
    }
    if (txn.status !== 'approved' && txn.status !== 'draft') {
      return { success: false, error: `Only approved or draft transactions can be posted. Current status is '${txn.status}'.` };
    }

    const module = moduleForTransactionType(transactionType);
    if (!module) {
      return { success: false, error: `${transactionType} transactions do not go through an approval workflow.` };
    }

    try {
      await accountingService.transitionTransaction(module, txn.id, 'post');
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to post transaction.' };
    }

    txn.status = 'posted';
    txn.postedBy = currentUser.id;
    txn.postedAt = new Date().toISOString();

    notificationService.notifyStatusChange(txn, 'approved', 'posted', currentUser.fullName);
    notificationCenter.workflowAction('posted', txn.documentRef, `Committed to General Ledger by ${currentUser.fullName}.`);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} posted to General Ledger and Project Accounts.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Fetch all pending approvals (status 'submitted') matching user permissions and project scope
   */
  public getPendingApprovals(): Transaction[] {
    const all = accountingService.getAllTransactions();
    const pending = all.filter((t) => t.status === 'submitted');
    return authService.filterAccessibleTransactions(pending);
  }

  /**
   * Fetch transactions approved and awaiting posting to the General Ledger (status 'approved')
   */
  public getPendingPosting(): Transaction[] {
    const all = accountingService.getAllTransactions();
    const approved = all.filter((t) => t.status === 'approved');
    return authService.filterAccessibleTransactions(approved);
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
