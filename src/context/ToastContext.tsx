import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export type ToastInput = {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

// Global toast helper that can be imported and called anywhere
export const toast = {
  show: (input: ToastInput): string => {
    const item: ToastItem = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      title: input.title,
      message: input.message,
      duration: input.duration ?? (input.type === 'error' ? 6000 : 4500),
    };
    listeners.forEach((listener) => listener(item));
    return item.id;
  },
  success: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'success', title, message, duration }),
  error: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'error', title, message, duration }),
  info: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'info', title, message, duration }),
  warning: (title: string, message?: string, duration?: number): string =>
    toast.show({ type: 'warning', title, message, duration }),
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

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0 print:hidden"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl shadow-xl border p-3.5 flex items-start gap-3 transition-all duration-200 animate-in slide-in-from-top-2 fade-in ${
            t.type === 'success'
              ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-slate-100'
              : t.type === 'error'
              ? 'bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-slate-900 dark:text-slate-100'
              : t.type === 'warning'
              ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-slate-900 dark:text-slate-100'
              : 'bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-800 text-slate-900 dark:text-slate-100'
          }`}
        >
          {/* Status Icon */}
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              t.type === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                : t.type === 'error'
                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                : t.type === 'warning'
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                : 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {t.type === 'info' && <Info className="w-4 h-4" />}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
              {t.title}
            </h4>
            {t.message && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed break-words">
                {t.message}
              </p>
            )}
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
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
      setToasts((prev) => [...prev, item]);

      if (item.duration && item.duration > 0) {
        setTimeout(() => {
          dismissToast(item.id);
        }, item.duration);
      }
    },
    [dismissToast]
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
