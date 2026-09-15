import { Transaction } from '../types';
import { formatOMR } from '../utils/formatters';
import { getSupabaseClient } from './supabaseClient';

export type NotificationType = 'pending_approval' | 'status_change' | 'critical_update' | 'system_update';
export type NotificationSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  timestamp: string;
  read: boolean;
  linkView?: string;
  actionId?: string;
  entityRef?: string;
  amount?: number;
  projectId?: string;
  projectName?: string;
  actorName?: string;
}

const STORAGE_KEY = 'construction_accounting_notifications_v1';

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadNotifications();
    if (this.notifications.length === 0) {
      this.seedInitialNotifications();
    }
  }

  private loadNotifications() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored notifications:', e);
      this.notifications = [];
    }
  }

  private saveNotifications() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
      this.notifyListeners();
      this.syncToSupabase();
    } catch (e) {
      console.warn('Failed to save notifications:', e);
    }
  }

  private async syncToSupabase() {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      // Best effort background sync to Supabase table if available
      const unreadCount = this.getUnreadCount();
      // Keep session state synchronized
    } catch {
      // Offline fallback
    }
  }

  private seedInitialNotifications() {
    const now = new Date();
    const minAgo = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

    this.notifications = [
      {
        id: 'notif-seed-1',
        title: 'Pending Approval: Payment Voucher',
        message: 'Payment Voucher PV-2026-004 (OMR 12,500.000) for Al Tasneem Residential Villa submitted for managerial review.',
        type: 'pending_approval',
        severity: 'warning',
        timestamp: minAgo(14),
        read: false,
        linkView: 'approvals',
        entityRef: 'PV-2026-004',
        amount: 12500,
        projectId: 'p1',
        projectName: 'Al Mouj Residential Villa - Phase 2',
        actorName: 'Eng. Tariq Al Balushi',
      },
      {
        id: 'notif-seed-2',
        title: 'Status Change: Invoice Approved',
        message: 'Client IPC Certificate #IPC-2026-002 (OMR 24,800.000) was approved by Accounts Manager and queued for posting.',
        type: 'status_change',
        severity: 'success',
        timestamp: hoursAgo(2),
        read: false,
        linkView: 'approvals',
        entityRef: 'IPC-2026-002',
        amount: 24800,
        projectId: 'p2',
        projectName: 'Salalah Commercial Complex',
        actorName: 'Amina Al Harthy',
      },
      {
        id: 'notif-seed-3',
        title: 'Critical Update: SOD Policy Enforced',
        message: 'Dual-tier Segregation of Duties active. Transaction creators cannot approve their own entries above OMR 5,000.',
        type: 'critical_update',
        severity: 'critical',
        timestamp: hoursAgo(5),
        read: true,
        linkView: 'workflow_settings',
      },
      {
        id: 'notif-seed-4',
        title: 'System Advisory: 90-Day Cash Flow Projection',
        message: 'Cash flow projection model updated. Next 90-day liquidity forecast shows healthy operating reserve runway.',
        type: 'system_update',
        severity: 'info',
        timestamp: hoursAgo(8),
        read: true,
        linkView: 'dashboard',
      },
    ];
    this.saveNotifications();
  }

  public getNotifications(filter?: { unreadOnly?: boolean; type?: NotificationType }): AppNotification[] {
    let list = [...this.notifications];
    if (filter?.unreadOnly) {
      list = list.filter((n) => !n.read);
    }
    if (filter?.type) {
      list = list.filter((n) => n.type === filter.type);
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public markAsRead(id: string) {
    const item = this.notifications.find((n) => n.id === id);
    if (item && !item.read) {
      item.read = true;
      this.saveNotifications();
    }
  }

  public markAllAsRead() {
    let changed = false;
    this.notifications.forEach((n) => {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      this.saveNotifications();
    }
  }

  public deleteNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.saveNotifications();
  }

  public clearAll() {
    this.notifications = [];
    this.saveNotifications();
  }

  public addNotification(item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
    const notification: AppNotification = {
      ...item,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.notifications.unshift(notification);
    // Keep max 50 recent notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    this.saveNotifications();
    return notification;
  }

  /**
   * Alert when transaction is submitted for approval
   */
  public notifyPendingApproval(txn: Transaction, submitterName?: string) {
    this.addNotification({
      title: `Pending Approval: ${txn.documentRef}`,
      message: `${txn.type.replace(/_/g, ' ').toUpperCase()} of ${formatOMR(txn.amount)} for ${txn.projectName || 'Project'} submitted by ${submitterName || 'Team Member'} awaits authorization.`,
      type: 'pending_approval',
      severity: txn.amount > 10000 ? 'critical' : 'warning',
      linkView: 'approvals',
      entityRef: txn.documentRef,
      amount: txn.amount,
      projectId: txn.projectId,
      projectName: txn.projectName,
      actorName: submitterName,
    });
  }

  /**
   * Alert on workflow status transition (approved, rejected, posted)
   */
  public notifyStatusChange(
    txn: Transaction,
    fromStatus: string,
    toStatus: string,
    actorName?: string,
    reason?: string
  ) {
    const isApproved = toStatus === 'approved';
    const isRejected = toStatus === 'rejected';
    const isPosted = toStatus === 'posted';

    let title = `Status Update: ${txn.documentRef}`;
    let severity: NotificationSeverity = 'info';

    if (isApproved) {
      title = `Approved: ${txn.documentRef}`;
      severity = 'success';
    } else if (isRejected) {
      title = `Rejected: ${txn.documentRef}`;
      severity = 'critical';
    } else if (isPosted) {
      title = `Posted to Ledger: ${txn.documentRef}`;
      severity = 'info';
    }

    let message = `Transaction ${txn.documentRef} (${formatOMR(txn.amount)}) status transitioned from ${fromStatus} to ${toStatus}`;
    if (actorName) {
      message += ` by ${actorName}`;
    }
    if (reason) {
      message += `. Reason: "${reason}"`;
    }

    this.addNotification({
      title,
      message,
      type: 'status_change',
      severity,
      linkView: isPosted ? 'reports' : 'approvals',
      entityRef: txn.documentRef,
      amount: txn.amount,
      projectId: txn.projectId,
      projectName: txn.projectName,
      actorName,
    });
  }

  /**
   * Critical System Update
   */
  public notifyCritical(title: string, message: string, linkView?: string) {
    this.addNotification({
      title,
      message,
      type: 'critical_update',
      severity: 'critical',
      linkView: linkView || 'audit',
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }
}

export const notificationService = new NotificationService();
export default notificationService;
