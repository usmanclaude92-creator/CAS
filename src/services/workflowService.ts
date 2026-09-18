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

class WorkflowService {
  /**
   * Submit transaction for approval (Draft -> Submitted)
   */
  public submitTransaction(transactionId: string, transactionType: TransactionType): WorkflowActionResult {
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

    // Verify project access
    if (!authService.canAccessProject(txn.projectId)) {
      return { success: false, error: 'Access denied: You are not authorized for this project.' };
    }

    // Update status to 'submitted'
    txn.status = 'submitted';
    txn.submittedBy = currentUser.id;
    txn.submittedAt = new Date().toISOString();

    accountingService.updateTransactionWorkflowStatus(txn.id, 'submitted', {
      submittedBy: txn.submittedBy,
      submittedAt: txn.submittedAt,
    });

    accountingService.addAuditLog(
      'WORKFLOW_SUBMIT',
      'APPROVALS',
      `Submitted transaction ${txn.documentRef} (${txn.type}) of amount OMR ${txn.amount.toFixed(3)} for approval`,
      txn.documentRef,
      txn.id,
      'draft',
      'submitted'
    );

    // Alert relevant users to pending approval
    notificationService.notifyPendingApproval(txn, currentUser.fullName);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} successfully submitted for managerial approval.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Approve transaction (Submitted -> Approved)
   * Enforces Separation of Duties and Role Approval Limits!
   */
  public approveTransaction(transactionId: string, transactionType: TransactionType): WorkflowActionResult {
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

    // Verify project access
    if (!authService.canAccessProject(txn.projectId)) {
      notificationCenter.unauthorized('Project Scope Access', 'Access denied: You are not authorized for this project.');
      return { success: false, error: 'Access denied: You are not authorized for this project.' };
    }

    // Check Separation of Duties & Limits
    const creatorId = txn.createdBy || txn.submittedBy;
    const check = authService.canApproveTransaction(txn.amount, creatorId);
    if (!check.allowed) {
      notificationCenter.unauthorized('Approval Policy Violation', check.reason || 'Approval denied due to security policy.');
      return { success: false, error: check.reason || 'Approval denied due to security policy.' };
    }

    txn.status = 'approved';
    txn.approvedBy = currentUser.id;
    txn.approvedByName = currentUser.fullName;
    txn.approvedAt = new Date().toISOString();

    accountingService.updateTransactionWorkflowStatus(txn.id, 'approved', {
      approvedBy: txn.approvedBy,
      approvedByName: txn.approvedByName,
      approvedAt: txn.approvedAt,
    });

    accountingService.addAuditLog(
      'WORKFLOW_APPROVE',
      'APPROVALS',
      `Approved transaction ${txn.documentRef} (${txn.type}) of amount OMR ${txn.amount.toFixed(3)} by ${currentUser.fullName}`,
      txn.documentRef,
      txn.id,
      'submitted',
      'approved'
    );

    // Alert status update
    notificationService.notifyStatusChange(txn, 'submitted', 'approved', currentUser.fullName);
    notificationCenter.workflowAction('approved', txn.documentRef, `Approved by ${currentUser.fullName}. Ready to post.`);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} successfully approved. Ready to post.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Reject transaction (Submitted -> Rejected)
   * Requires mandatory rejection reason!
   */
  public rejectTransaction(transactionId: string, transactionType: TransactionType, reason: string): WorkflowActionResult {
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

    // Check reject permission
    if (!authService.hasPermission('approvals.reject') && !authService.isSuperAdmin() && !authService.isAccountsManager()) {
      notificationCenter.unauthorized('Privilege Check', 'Missing required privilege: approvals.reject');
      return { success: false, error: 'Missing required privilege: approvals.reject' };
    }

    txn.status = 'rejected';
    txn.rejectionReason = reason.trim();

    accountingService.updateTransactionWorkflowStatus(txn.id, 'rejected', {
      rejectionReason: txn.rejectionReason,
    });

    accountingService.addAuditLog(
      'WORKFLOW_REJECT',
      'APPROVALS',
      `Rejected transaction ${txn.documentRef}: Reason: ${reason.trim()}`,
      txn.documentRef,
      txn.id,
      'submitted',
      'rejected'
    );

    // Alert rejection status update
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
  public postTransaction(transactionId: string, transactionType: TransactionType): WorkflowActionResult {
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

    txn.status = 'posted';
    txn.postedBy = currentUser.id;
    txn.postedAt = new Date().toISOString();

    accountingService.updateTransactionWorkflowStatus(txn.id, 'posted', {
      postedBy: txn.postedBy,
      postedAt: txn.postedAt,
    });

    accountingService.addAuditLog(
      'WORKFLOW_POST',
      'GENERAL_LEDGER',
      `Posted transaction ${txn.documentRef} to ledger by ${currentUser.fullName}`,
      txn.documentRef,
      txn.id,
      'approved',
      'posted'
    );

    // Alert posting status update
    notificationService.notifyStatusChange(txn, 'approved', 'posted', currentUser.fullName);
    notificationCenter.workflowAction('posted', txn.documentRef, `Committed to General Ledger by ${currentUser.fullName}.`);

    return {
      success: true,
      message: `Transaction ${txn.documentRef} posted to General Ledger and Project Accounts.`,
      updatedTransaction: txn,
    };
  }

  /**
   * Fetch all pending approvals matching user permissions and project scope
   */
  public getPendingApprovals(): Transaction[] {
    const all = accountingService.getAllTransactions();
    const pending = all.filter((t) => t.status === 'submitted');
    return authService.filterAccessibleTransactions(pending);
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
