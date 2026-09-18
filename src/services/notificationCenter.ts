import { toast } from '../context/ToastContext';
import { notificationService } from './notificationService';
import { authService } from './authService';

/**
 * Centralized Notification System
 * Orchestrates real-time toast alerts, in-app notification drawer records,
 * and security event telemetry across the entire application.
 */
class NotificationCenter {
  /**
   * Triggers a toast alert and notification when a business record is successfully saved
   * (e.g., Client Invoice, Purchase Bill, Expense, Receipts, Bank Transfer, Master Records).
   */
  public recordSaved(
    entityType: string,
    recordIdentifier: string,
    details?: string,
    duration: number = 4500
  ): string {
    const toastId = toast.recordSaved(entityType, recordIdentifier, details, duration);

    // Also register in persistent in-app notifications drawer
    notificationService.addNotification({
      title: `${entityType} Saved`,
      message: details
        ? `${recordIdentifier} — ${details}`
        : `Record for "${recordIdentifier}" was committed to the ledger database.`,
      type: 'system_update',
      severity: 'success',
      entityRef: recordIdentifier,
      actorName: authService.getCurrentUser()?.fullName,
    });

    return toastId;
  }

  /**
   * Triggers a toast alert when an existing record is successfully updated
   */
  public recordUpdated(
    entityType: string,
    recordIdentifier: string,
    details?: string
  ): string {
    return toast.show({
      type: 'success',
      title: `${entityType} Updated`,
      message: details
        ? `${recordIdentifier} — ${details}`
        : `Changes to ${recordIdentifier} saved successfully.`,
      iconType: 'check',
    });
  }

  /**
   * Triggers a toast alert when a financial transaction is reversed with an audit trail
   */
  public recordReversed(recordRef: string, reason: string): string {
    const toastId = toast.show({
      type: 'warning',
      title: `Transaction Reversed: ${recordRef}`,
      message: `Reversing journal entry posted. Reason: "${reason}". Associated ledgers updated.`,
      duration: 6000,
      iconType: 'alert',
    });

    notificationService.addNotification({
      title: `Transaction Reversed: ${recordRef}`,
      message: `Reversal executed by ${authService.getCurrentUser()?.fullName || 'User'}: "${reason}"`,
      type: 'critical_update',
      severity: 'warning',
      linkView: 'audit',
      entityRef: recordRef,
      actorName: authService.getCurrentUser()?.fullName,
    });

    return toastId;
  }

  /**
   * Triggers a high-priority security toast alert when an unauthorized action,
   * permission restriction, or project boundary violation is detected.
   */
  public unauthorized(actionOrResource: string, reason?: string): string {
    const toastId = toast.unauthorized(actionOrResource, reason);

    // Record in critical notifications drawer for audit visibility
    notificationService.notifyCritical(
      'Security Alert: Unauthorized Action',
      reason || `Access denied for action "${actionOrResource}". Permission check failed.`,
      'audit'
    );

    return toastId;
  }

  /**
   * Triggers an urgent session inactivity countdown toast
   */
  public sessionWarning(
    remainingSeconds: number = 60,
    onStaySignedIn?: () => void
  ): string {
    return toast.sessionWarning(remainingSeconds, onStaySignedIn);
  }

  /**
   * Triggers a confirmation toast when the user extends their idle session
   */
  public sessionExtended(): string {
    return toast.sessionExtended();
  }

  /**
   * Triggers a session expiration notification toast
   */
  public sessionExpired(): string {
    return toast.sessionExpired();
  }

  /**
   * Triggers a workflow transition alert (Approval, Rejection, Posting)
   */
  public workflowAction(
    action: 'approved' | 'rejected' | 'posted' | 'submitted',
    docRef: string,
    details?: string
  ): string {
    if (action === 'approved') {
      return toast.show({
        type: 'success',
        title: `Transaction Approved: ${docRef}`,
        message: details || `Transaction ${docRef} authorized and ready for posting.`,
        iconType: 'check',
      });
    }

    if (action === 'rejected') {
      return toast.show({
        type: 'error',
        title: `Transaction Rejected: ${docRef}`,
        message: details || `Transaction ${docRef} returned for amendment.`,
        iconType: 'alert',
      });
    }

    if (action === 'posted') {
      return toast.show({
        type: 'info',
        title: `Posted to General Ledger: ${docRef}`,
        message: details || `Transaction ${docRef} finalized in double-entry accounts.`,
        iconType: 'database',
      });
    }

    return toast.show({
      type: 'info',
      title: `Submitted for Approval: ${docRef}`,
      message: details || `Transaction ${docRef} submitted to authorizers.`,
      iconType: 'clock',
    });
  }

  /**
   * General system event trigger
   */
  public systemEvent(
    title: string,
    message: string,
    severity: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): string {
    return toast.show({
      type: severity,
      title,
      message,
    });
  }
}

export const notificationCenter = new NotificationCenter();
export default notificationCenter;
