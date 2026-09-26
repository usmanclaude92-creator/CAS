import { Transaction } from '../types';
import { formatOMR } from '../utils/formatters';
import { getSupabaseClient } from './supabaseClient';
import { authService } from './authService';

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

function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    severity: row.severity,
    timestamp: row.timestamp,
    read: row.read,
    linkView: row.link_view ?? undefined,
    actionId: row.action_id ?? undefined,
    entityRef: row.entity_ref ?? undefined,
    amount: row.amount != null ? Number(row.amount) : undefined,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    actorName: row.actor_name ?? undefined,
  };
}

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: (() => void)[] = [];
  private loaded = false;
  private realtimeChannel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;

  constructor() {
    authService.subscribe(() => {
      if (authService.isAuthenticated() && !this.loaded) {
        this.loadNotifications();
      }
      if (!authService.isAuthenticated()) {
        this.teardownRealtime();
        this.notifications = [];
        this.loaded = false;
        this.notifyListeners();
      }
    });
    if (authService.isAuthenticated()) {
      this.loadNotifications();
    }
  }

  private async loadNotifications() {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      this.notifications = (data ?? []).map(mapNotification);
      this.loaded = true;
      this.setupRealtime();
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to load notifications from Supabase:', e);
    }
  }

  private setupRealtime() {
    const client = getSupabaseClient();
    if (!client || this.realtimeChannel) return;
    this.realtimeChannel = client
      .channel('notifications-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        this.loadNotifications();
      })
      .subscribe();
  }

  private teardownRealtime() {
    const client = getSupabaseClient();
    if (client && this.realtimeChannel) {
      client.removeChannel(this.realtimeChannel);
    }
    this.realtimeChannel = null;
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

  public async markAsRead(id: string) {
    const item = this.notifications.find((n) => n.id === id);
    if (!item || item.read) return;
    item.read = true;
    this.notifyListeners();
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('notifications').update({ read: true }).eq('id', id);
    if (error) console.warn('Failed to mark notification as read:', error);
  }

  public async markAllAsRead() {
    const unreadIds = this.notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    this.notifications.forEach((n) => {
      n.read = true;
    });
    this.notifyListeners();
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('notifications').update({ read: true }).in('id', unreadIds);
    if (error) console.warn('Failed to mark all notifications as read:', error);
  }

  public async deleteNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.notifyListeners();
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('notifications').delete().eq('id', id);
    if (error) console.warn('Failed to delete notification:', error);
  }

  public async clearAll() {
    const ids = this.notifications.map((n) => n.id);
    this.notifications = [];
    this.notifyListeners();
    const client = getSupabaseClient();
    if (!client || ids.length === 0) return;
    const { error } = await client.from('notifications').delete().in('id', ids);
    if (error) console.warn('Failed to clear notifications:', error);
  }

  public async addNotification(item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const payload = {
      title: item.title,
      message: item.message,
      type: item.type,
      severity: item.severity,
      link_view: item.linkView ?? null,
      action_id: item.actionId ?? null,
      entity_ref: item.entityRef ?? null,
      amount: item.amount ?? null,
      project_id: item.projectId ?? null,
      project_name: item.projectName ?? null,
      actor_name: item.actorName ?? null,
      user_id: null, // broadcast: visible to every active user per RLS (user_id is null)
    };

    try {
      const { data, error } = await client.from('notifications').insert([payload]).select().single();
      if (error) throw error;
      this.notifications.unshift(mapNotification(data));
      if (this.notifications.length > 100) {
        this.notifications = this.notifications.slice(0, 100);
      }
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to save notification to Supabase:', e);
    }
  }

  /**
   * Alert when transaction is submitted for approval
   */
  public notifyPendingApproval(txn: Transaction, submitterName?: string) {
    void this.addNotification({
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

    void this.addNotification({
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
    void this.addNotification({
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
