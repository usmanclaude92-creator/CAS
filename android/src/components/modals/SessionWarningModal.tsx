import React, { useEffect } from 'react';
import { ShieldAlert, Clock, RefreshCw, LogOut } from 'lucide-react';

interface SessionWarningModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtendSession: () => void;
  onLogoutNow: () => void;
}

export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  remainingSeconds,
  onExtendSession,
  onLogoutNow,
}) => {
  // Allow pressing Enter or Space to quickly extend session
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onExtendSession();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExtendSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onExtendSession]);

  if (!isOpen) return null;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / 60) * 100));
  const isUrgent = remainingSeconds <= 15;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-300 dark:border-amber-700/60 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Warning Strip */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header with security icon & badge */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isUrgent
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
              }`}
            >
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  Security Timeout
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Compliance Safeguard
                </span>
              </div>
              <h2
                id="session-warning-title"
                className="text-lg font-bold text-slate-900 dark:text-white mt-1"
              >
                Session Expiration Warning
              </h2>
            </div>
          </div>

          {/* Countdown Clock Display */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Automatic sign-out in:</span>
            </div>

            <div className="flex items-baseline justify-center gap-1.5">
              <span
                className={`font-mono text-4xl font-extrabold tracking-tight ${
                  isUrgent
                    ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {remainingSeconds}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                seconds
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              Your session has been idle. To protect company financial data and prevent unauthorized ledger access, you will be signed out automatically.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onExtendSession}
              autoFocus
              className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Stay Signed In (Extend)</span>
            </button>

            <button
              type="button"
              onClick={onLogoutNow}
              className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
