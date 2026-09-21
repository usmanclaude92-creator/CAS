import React, { useState, useEffect } from 'react';
import {
  HardHat,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Users,
  Sparkles,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { ThemeToggle } from '../ThemeToggle';
import { DemoUsersModal } from '../modals/DemoUsersModal';
import { DemoApprovalModal } from '../modals/DemoApprovalModal';

interface LoginViewProps {
  onLoginSuccess: () => void;
  sessionExpiredNotice?: string | null;
  onClearExpiredNotice?: () => void;
  onOpenAdminApprovals?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  sessionExpiredNotice,
  onClearExpiredNotice,
  onOpenAdminApprovals,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Admin approval URL parameter detection (?action=approve_demo&requestId=...&token=...)
  const [approvalRequestId, setApprovalRequestId] = useState<string | null>(null);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      const reqId = params.get('requestId');
      const tok = params.get('token');

      if (action === 'approve_demo' && reqId) {
        setApprovalRequestId(reqId);
        setApprovalToken(tok);
        setIsApprovalModalOpen(true);
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        onOpenAdminApprovals?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAdminApprovals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your company email address.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.login(email, password, rememberMe);
      if (result.success) {
        onLoginSuccess();
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please check credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    const res = await authService.resetPassword(forgotEmail);
    setForgotStatus(res);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Top Header Bar with Theme Toggle */}
      <header className="p-4 sm:p-6 flex items-center justify-end max-w-7xl w-full mx-auto">
        {/* Visible Dark/Light Theme Toggle on Login Screen (Mandatory Requirement) */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400">Appearance:</span>
          <ThemeToggle variant="dropdown" />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-4">
          {/* Brand Logo Header - 60% of container width, background matching screen */}
          <div className="w-full flex justify-center items-center py-1">
            {/* Light Mode Logo */}
            <img
              src="/artify-logo-light.png"
              alt="Artify Construction Accounting System"
              className="w-[60%] h-auto object-contain block dark:hidden select-none bg-transparent"
            />
            {/* Dark Mode Logo */}
            <img
              src="/artify-logo.png"
              alt="Artify Construction Accounting System"
              className="w-[60%] h-auto object-contain hidden dark:block select-none bg-transparent"
            />
          </div>

          {/* Sign In Container */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sign In to Your Account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your credentials to access Enter your corporate account
            </p>
          </div>

          {sessionExpiredNotice && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-bold block text-amber-900 dark:text-amber-100">
                  Security Timeout
                </span>
                <span className="text-[11px] leading-relaxed">
                  {sessionExpiredNotice}
                </span>
              </div>
              {onClearExpiredNotice && (
                <button
                  type="button"
                  onClick={onClearExpiredNotice}
                  className="text-amber-500 hover:text-amber-700 text-xs font-bold shrink-0 ml-1"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Corporate Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@artifysols.com"
                  required
                  className="w-full text-xs pl-9.5 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full text-xs pl-9.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">Remember session</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Access & Role Directory */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center mb-3">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Want to Explore
              </span>
            </div>

            {/* Explore roles & request demo button */}
            <button
              type="button"
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 text-left transition-all group cursor-pointer shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Explore Roles &amp; Request Demo
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300">
                        8 Enterprise Roles
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Review governance permissions &amp; request authorized demo access
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all ml-2">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Developer Attribution */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1 space-y-1">
          <p>
            This Software is designed and developed by{' '}
            <strong className="font-bold text-black dark:text-white">
              Artify Solutions
            </strong>.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://artifysols.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="italic text-blue-600 dark:text-blue-400 hover:underline inline-block font-medium"
            >
              www.artifysols.com
            </a>
            {onOpenAdminApprovals && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={onOpenAdminApprovals}
                  className="text-[11px] text-slate-400 dark:text-slate-600 hover:text-purple-600 dark:hover:text-purple-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  title="Restricted Administrative Demo Approvals Route (Ctrl+Alt+A)"
                >
                  <Lock className="w-3 h-3" />
                  <span>Admin Portal</span>
                </button>
              </>
            )}
          </div>
        </div>
        </div>
      </main>

      {/* Role Directory & Demo Request Modal */}
      <DemoUsersModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />

      {/* Admin Demo Approval Authorization Modal (triggered via link) */}
      <DemoApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
        requestId={approvalRequestId}
        token={approvalToken}
        onInstantLogin={(approvedEmail) => {
          setEmail(approvedEmail);
          setIsApprovalModalOpen(false);
        }}
      />

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your corporate email address. A password reset link will be dispatched securely via Supabase Auth.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="corporate@construction.om"
                required
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {forgotStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    forgotStatus.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {forgotStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{forgotStatus.message}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setForgotStatus(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-400 dark:text-slate-600">
        &copy; 2026 Construction Accounting &amp; Financial Reporting ERP &bull; Compliant with Omani Commercial Law &bull; Currency OMR
      </footer>
    </div>
  );
};

export default LoginView;
