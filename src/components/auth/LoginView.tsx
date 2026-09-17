import React, { useState } from 'react';
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
} from 'lucide-react';
import { authService } from '../../services/authService';
import { ThemeToggle } from '../ThemeToggle';
import { ArtifyLogo } from '../ArtifyLogo';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('superadmin@construction.om');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleSelectQuickAccount = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('Construction@2026');
    setErrorMessage('');
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
      <header className="p-4 sm:p-6 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <ArtifyLogo className="h-10 w-auto rounded-lg shadow-sm" />
        </div>

        {/* Visible Dark/Light Theme Toggle on Login Screen (Mandatory Requirement) */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400">Appearance:</span>
          <ThemeToggle variant="dropdown" />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sign In to Your Account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your corporate credentials to access the financial ledger
            </p>
          </div>

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
                  placeholder="name@construction.om"
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

          {/* Demo Users Quick Access (Isolated Demo Database Only) */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Demo Users (Sandbox Database)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                Isolated Demo
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              Select a demo profile below to explore role permissions within the isolated demo sandbox. Real accounts log in above.
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-left text-[11px]">
              {authService
                .getDemoUsers()
                .filter((u) => u.status === 'active')
                .map((demoUser) => {
                  const isCurrent = email.toLowerCase() === demoUser.email.toLowerCase();
                  return (
                    <button
                      key={demoUser.id}
                      type="button"
                      onClick={() => handleSelectQuickAccount(demoUser.email)}
                      className={`p-2 rounded-xl border transition-all text-left truncate cursor-pointer ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100 font-bold shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-medium'
                      }`}
                      title={`${demoUser.fullName} (${demoUser.roleName})`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{demoUser.roleName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {demoUser.fullName}
                      </div>
                    </button>
                  );
                })}
            </div>
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => handleSelectQuickAccount('inactive@construction.om')}
                className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-rose-500 underline cursor-pointer"
              >
                Test Inactive User Block
              </button>
            </div>
          </div>
        </div>
      </main>

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
