import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  ShieldAlert,
  Clock,
  Database,
  Lock,
  ArrowRight,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastIconType = 'default' | 'shield' | 'clock' | 'database' | 'lock' | 'check' | 'alert';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  iconType?: ToastIconType;
  action?: ToastAction;
  createdAt: number;
}

export type ToastInput = {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  iconType?: ToastIconType;
  action?: ToastAction;
};

type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

// Anti-spam cache: tracks recent toasts to prevent identical duplicate spam within 2 seconds
const recentToastCache = new Map<string, number>();

// Global toast helper that can be imported and called anywhere
export const toast = {
  show: (input: ToastInput): string => {
    const cacheKey = `${input.type}:${input.title}:${input.message || ''}`;
    const now = Date.now();
    const lastShown = recentToastCache.get(cacheKey) || 0;
    if (now - lastShown < 1500) {
      // Deduplicate rapid identical triggers
      return '';
    }
    recentToastCache.set(cacheKey, now);
    if (recentToastCache.size > 50) {
      // prune old entries
      for (const [k, time] of recentToastCache.entries()) {
        if (now - time > 5000) recentToastCache.delete(k);
      }
    }

    const defaultDuration =
      input.type === 'error' ? 6500 : input.type === 'warning' ? 6000 : 4500;

    const item: ToastItem = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      title: input.title,
      message: input.message,
      duration: input.duration ?? defaultDuration,
      iconType: input.iconType,
      action: input.action,
      createdAt: now,
    };
    listeners.forEach((listener) => listener(item));
    return item.id;
  },

  success: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'success', title, message, duration, iconType: 'check' }),

  error: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'error', title, message, duration, iconType: 'alert' }),

  info: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'info', title, message, duration }),

  warning: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'warning', title, message, duration, iconType: 'alert' }),

  /**
   * Specialized trigger for successful record creation / update / save
   */
  recordSaved: (
    entity: string,
    identifier: string,
    details?: string,
    duration?: number
  ): string =>
    toast.show({
      type: 'success',
      title: `${entity} Saved Successfully`,
      message: details
        ? `${identifier} — ${details}`
        : `Record for "${identifier}" was saved successfully to the system.`,
      duration: duration ?? 5000,
      iconType: 'check',
    }),

  /**
   * Specialized trigger for security violations, unauthorized access, or permission denials
   */
  unauthorized: (
    actionOrResource: string,
    reason?: string,
    duration?: number
  ): string =>
    toast.show({
      type: 'error',
      title: 'Access Restricted (Unauthorized)',
      message:
        reason ||
        `Your account role does not have authorization to perform: ${actionOrResource}.`,
      duration: duration ?? 6500,
      iconType: 'shield',
    }),

  /**
   * Specialized trigger for idle session security warnings (e.g. 60s countdown)
   */
  sessionWarning: (
    secondsRemaining: number = 60,
    onStaySignedIn?: () => void,
    duration?: number
  ): string =>
    toast.show({
      type: 'warning',
      title: 'Session Inactivity Warning',
      message: `Your session will expire in ${secondsRemaining} seconds due to inactivity. Move your mouse or click below to remain signed in.`,
      duration: duration ?? 10000,
      iconType: 'clock',
      action: onStaySignedIn
        ? {
            label: 'Stay Signed In',
            onClick: onStaySignedIn,
          }
        : undefined,
    }),

  /**
   * Trigger when a session is extended / refreshed
   */
  sessionExtended: (duration?: number): string =>
    toast.show({
      type: 'success',
      title: 'Session Extended',
      message: 'Your active session has been renewed. Idle timeout reset.',
      duration: duration ?? 3500,
      iconType: 'clock',
    }),

  /**
   * Trigger when a session expires due to timeout
   */
  sessionExpired: (duration?: number): string =>
    toast.show({
      type: 'warning',
      title: 'Session Expired',
      message: 'You were automatically logged out due to inactivity to protect company financial records.',
      duration: duration ?? 8000,
      iconType: 'lock',
    }),
};

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
  toast: typeof toast;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toasts: [],
      showToast: toast.show,
      dismissToast: () => {},
      toast,
    };
  }
  return ctx;
};

interface ToastItemComponentProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastItemComponentProps> = ({ toast: t, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(t.duration || 5000);
  const totalDuration = t.duration || 5000;

  useEffect(() => {
    if (!t.duration || t.duration <= 0) return;

    let frameId: number;
    const updateProgress = () => {
      if (!isPaused) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, remainingTimeRef.current - elapsed);
        const pct = (remaining / totalDuration) * 100;
        setProgress(pct);

        if (remaining <= 0) {
          onDismiss(t.id);
          return;
        }
      }
      frameId = requestAnimationFrame(updateProgress);
    };

    frameId = requestAnimationFrame(updateProgress);

    return () => cancelAnimationFrame(frameId);
  }, [t.id, t.duration, totalDuration, isPaused, onDismiss]);

  const handleMouseEnter = () => {
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  const renderIcon = () => {
    if (t.iconType === 'shield') return <ShieldAlert className="w-4 h-4" />;
    if (t.iconType === 'clock') return <Clock className="w-4 h-4" />;
    if (t.iconType === 'database') return <Database className="w-4 h-4" />;
    if (t.iconType === 'lock') return <Lock className="w-4 h-4" />;
    if (t.iconType === 'check') return <CheckCircle2 className="w-4 h-4" />;
    if (t.iconType === 'alert') return <AlertTriangle className="w-4 h-4" />;

    switch (t.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const borderColor =
    t.type === 'success'
      ? 'border-emerald-300 dark:border-emerald-700/80 shadow-emerald-500/10'
      : t.type === 'error'
      ? 'border-rose-300 dark:border-rose-700/80 shadow-rose-500/10'
      : t.type === 'warning'
      ? 'border-amber-300 dark:border-amber-700/80 shadow-amber-500/10'
      : 'border-blue-300 dark:border-blue-700/80 shadow-blue-500/10';

  const iconBg =
    t.type === 'success'
      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
      : t.type === 'error'
      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
      : t.type === 'warning'
      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
      : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300';

  const progressBarColor =
    t.type === 'success'
      ? 'bg-emerald-500'
      : t.type === 'error'
      ? 'bg-rose-500'
      : t.type === 'warning'
      ? 'bg-amber-500'
      : 'bg-blue-500';

  return (
    <div
      role="alert"
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative overflow-hidden rounded-xl shadow-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all duration-200 transform translate-y-0 opacity-100 animate-in slide-in-from-top-3 fade-in ${borderColor}`}
    >
      <div className="p-3.5 flex items-start gap-3">
        {/* Status Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {renderIcon()}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
              {t.title}
            </h4>
          </div>

          {t.message && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed break-words">
              {t.message}
            </p>
          )}

          {/* Action button if present */}
          {t.action && (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  onDismiss(t.id);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg text-white shadow-xs cursor-pointer transition-colors ${
                  t.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : t.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <span>{t.action.label}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(t.id)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown Progress Bar */}
      {t.duration && t.duration > 0 && (
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800/80">
          <div
            className={`h-full transition-all duration-75 ease-linear ${progressBarColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  // Show at most 5 recent toasts to keep the UI clean
  const visibleToasts = toasts.slice(-5);

  return (
    <div
      className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0 print:hidden"
      aria-live="polite"
      role="region"
      aria-label="System Notifications"
    >
      {visibleToasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (item: ToastItem) => {
      if (!item.id) return;
      setToasts((prev) => [...prev, item]);
    },
    []
  );

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast: toast.show, dismissToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};
