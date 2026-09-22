import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { notificationService, AppNotification, NotificationType } from '../services/notificationService';
import { NavView } from './Sidebar';
import { formatOMR } from '../utils/formatters';

interface HeaderNotificationsProps {
  onNavigateView: (view: NavView) => void;
}

export const HeaderNotifications: React.FC<HeaderNotificationsProps> = ({ onNavigateView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'pending_approval' | 'critical_update'>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>(notificationService.getNotifications());
  const [unreadCount, setUnreadCount] = useState<number>(notificationService.getUnreadCount());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reload = () => {
      setNotifications(notificationService.getNotifications());
      setUnreadCount(notificationService.getUnreadCount());
    };
    reload();
    const unsub = notificationService.subscribe(reload);
    return () => unsub();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead();
  };

  const handleItemClick = (n: AppNotification) => {
    notificationService.markAsRead(n.id);
    setIsOpen(false);
    if (n.linkView) {
      onNavigateView(n.linkView as NavView);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    notificationService.deleteNotification(id);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    if (activeFilter === 'pending_approval') return n.type === 'pending_approval';
    if (activeFilter === 'critical_update') return n.type === 'critical_update';
    return true;
  });

  const formatRelativeTime = (isoString: string) => {
    const now = new Date().getTime();
    const then = new Date(isoString).getTime();
    const diffMins = Math.floor((now - then) / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'pending_approval':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'status_change':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'critical_update':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'system_update':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'unread'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('pending_approval')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'pending_approval'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Approvals
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('critical_update')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'critical_update'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Critical
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center px-4">
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No notifications</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {activeFilter === 'unread' ? 'All caught up! No unread notifications.' : 'No alerts in this category.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                    !n.read
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {/* Icon Indicator */}
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    {getIcon(n.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          !n.read
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {formatRelativeTime(n.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="mt-1.5 flex items-center gap-2">
                      {n.amount && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {formatOMR(n.amount)}
                        </span>
                      )}
                      {n.projectName && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                          {n.projectName}
                        </span>
                      )}
                      {n.linkView && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5 ml-auto">
                          View details <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (mark read / delete) */}
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, n.id)}
                      title="Delete notification"
                      className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Unread blue dot */}
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{notifications.length} total saved</span>
              <button
                type="button"
                onClick={() => notificationService.clearAll()}
                className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default HeaderNotifications;
