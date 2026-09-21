import React, { useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Crown,
  Briefcase,
  Calculator,
  HardHat,
  Wallet,
  Eye,
  Building2,
  Lock,
  Sparkles,
  User,
  Mail,
  Phone,
  Send,
  FileText,
  BadgeCheck,
  Check,
  Layers,
} from 'lucide-react';
import {
  demoRequestService,
  VISITOR_SYSTEM_ROLES,
  SystemRoleInfo,
  DemoRequest,
} from '../../services/demoRequestService';

export type RoleCategoryFilter = 'all' | 'Executive' | 'Management' | 'Accounting' | 'Treasury' | 'Audit';

interface DemoUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoleCode?: string;
}

const CATEGORY_TABS: { id: RoleCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All Roles' },
  { id: 'Executive', label: 'Executive' },
  { id: 'Management', label: 'Management' },
  { id: 'Accounting', label: 'Accounting & Ops' },
  { id: 'Treasury', label: 'Treasury' },
  { id: 'Audit', label: 'Audit' },
];

export const DemoUsersModal: React.FC<DemoUsersModalProps> = ({
  isOpen,
  onClose,
  initialRoleCode,
}) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'request'>('directory');
  const [selectedCategory, setSelectedCategory] = useState<RoleCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoleCode, setSelectedRoleCode] = useState(initialRoleCode || 'super_admin');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<DemoRequest | null>(null);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleStartRequestForRole = (roleCode: string) => {
    setSelectedRoleCode(roleCode);
    setActiveTab('request');
    setFormError('');
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !email.trim() || !companyName.trim()) {
      setFormError('Please complete all required fields (Name, Corporate Email, and Company).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await demoRequestService.submitRequest({
        fullName,
        email,
        companyName,
        phone,
        roleCode: selectedRoleCode,
        purpose,
      });

      if (res.success && res.request) {
        setSubmittedRequest(res.request);
      } else {
        setFormError(res.error || 'Failed to submit demo request. Please try again.');
      }
    } catch {
      setFormError('A network error occurred while submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedRequest(null);
    setFullName('');
    setEmail('');
    setCompanyName('');
    setPhone('');
    setPurpose('');
    setActiveTab('directory');
    setFormError('');
  };

  const filteredRoles = VISITOR_SYSTEM_ROLES.filter((role) => {
    if (selectedCategory !== 'all' && role.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = role.name.toLowerCase().includes(q);
      const matchDesc = role.description.toLowerCase().includes(q);
      const matchModules = role.keyModules.some((m) => m.toLowerCase().includes(q));
      return matchName || matchDesc || matchModules;
    }
    return true;
  });

  const getRoleIcon = (code: string) => {
    switch (code) {
      case 'super_admin':
        return Crown;
      case 'accounts_manager':
      case 'finance_manager':
        return Briefcase;
      case 'accountant':
        return Calculator;
      case 'project_accountant':
        return HardHat;
      case 'treasury_user':
        return Wallet;
      case 'viewer':
        return Eye;
      default:
        return ShieldCheck;
    }
  };

  const getBadgeStyle = (category: string) => {
    switch (category) {
      case 'Executive':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Management':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Accounting':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Treasury':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'Audit':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-users-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="demo-users-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Enterprise Roles &amp; Demo Access
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Explore predefined roles, approval authorities, and submit a request for an authorized demo account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Tabs */}
        {!submittedRequest && (
          <div className="px-4 sm:px-5 pt-3 pb-0 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'directory'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Role Directory ({VISITOR_SYSTEM_ROLES.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('request')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'request'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Demo Access</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
          {/* SUCCESS SCREEN */}
          {submittedRequest ? (
            <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4 max-w-lg mx-auto animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Demo Request Submitted
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Thank you, <strong className="text-slate-800 dark:text-slate-200">{submittedRequest.fullName}</strong>. Your request for demo access as{' '}
                  <strong className="text-blue-600 dark:text-blue-400">{submittedRequest.roleName}</strong> has been received.
                </p>
              </div>

              <div className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Request Reference:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {submittedRequest.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target Role:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {submittedRequest.roleName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Organization:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {submittedRequest.companyName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Notification Dispatched:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Sent to System Administrator
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                An authorization link has been forwarded for administrative review. Once approved, login instructions and temporary access details will be delivered to your registered corporate address.
              </p>

              <div className="pt-2 flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Explore Other Roles
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          ) : activeTab === 'directory' ? (
            /* ROLE DIRECTORY VIEW */
            <div className="flex flex-col">
              {/* Filter and Search Bar */}
              <div className="p-3 sm:px-5 sm:py-3 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search roles by name, module, or responsibility..."
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  {CATEGORY_TABS.map((cat) => {
                    const count = VISITOR_SYSTEM_ROLES.filter(
                      (r) => cat.id === 'all' || r.category === cat.id
                    ).length;
                    const isActive = selectedCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roles List */}
              <div className="p-4 sm:p-5 space-y-3.5">
                {filteredRoles.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    No system roles found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {filteredRoles.map((role) => {
                      const Icon = getRoleIcon(role.code);
                      const badgeStyle = getBadgeStyle(role.category);

                      return (
                        <div
                          key={role.code}
                          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-xs flex flex-col justify-between gap-3 text-left"
                        >
                          {/* Top Row: Title, Category, Approval Authority */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {role.name}
                                  </h4>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {role.projectScope}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                                  {role.category}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {role.approvalLimitLabel}
                                </span>
                              </div>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {role.description}
                            </p>

                            {/* Key Responsibilities */}
                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Key Responsibilities:
                              </span>
                              <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-3 list-disc">
                                {role.responsibilities.slice(0, 3).map((resp, i) => (
                                  <li key={i}>{resp}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Accessible Modules Pills */}
                            <div className="flex items-center gap-1 flex-wrap pt-1">
                              <span className="text-[10px] text-slate-400 mr-1 font-medium">Modules:</span>
                              {role.keyModules.map((mod) => (
                                <span
                                  key={mod}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                                >
                                  {mod}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Button: Request This Role */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleStartRequestForRole(role.code)}
                              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:gap-2"
                            >
                              <span>Request Demo for This Role</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* REQUEST DEMO ACCESS FORM */
            <div className="p-5 sm:p-6 max-w-xl mx-auto space-y-5">
              <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  <span>Request Authorized Demo Account</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Provide your corporate details to request access. To preserve internal control and strict separation of duties, demo access requires administrative review.
                </p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Salim Al Harthy"
                      required
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                      placeholder="name@company.com"
                      required
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Your authorized demo credentials will be issued to this email.
                  </span>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Organization <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Al Madina Construction LLC"
                      required
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Phone (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+968 9123 4567"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Selected Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Desired Test Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedRoleCode}
                    onChange={(e) => setSelectedRoleCode(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VISITOR_SYSTEM_ROLES.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name} ({role.category} — {role.approvalLimitLabel})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Purpose / Message */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Area of Interest / Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Evaluating IPC billing, project profitability tracking, and multi-bank reconciliation."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Form Buttons */}
                <div className="pt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('directory')}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    ← Back to Role Directory
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Demo Request</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span className="text-[11px]">
            Compliant with Omani Corporate Governance &amp; Segregation of Duties
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
