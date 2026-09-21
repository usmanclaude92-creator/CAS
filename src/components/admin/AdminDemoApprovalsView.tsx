import React, { useState, useEffect, useMemo } from 'react';
import {
  demoRequestService,
  DemoRequest,
  VISITOR_SYSTEM_ROLES,
  SystemRoleInfo,
} from '../../services/demoRequestService';
import { authService } from '../../services/authService';
import { ThemeToggle } from '../ThemeToggle';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Send,
  Search,
  Filter,
  RefreshCw,
  ArrowLeft,
  KeyRound,
  Mail,
  Building,
  User,
  Phone,
  AlertTriangle,
  Lock,
  Sparkles,
  ChevronRight,
  Eye,
  Trash2,
} from 'lucide-react';

interface AdminDemoApprovalsViewProps {
  onBackToApp: () => void;
  initialRequestId?: string | null;
  initialToken?: string | null;
}

export const AdminDemoApprovalsView: React.FC<AdminDemoApprovalsViewProps> = ({
  onBackToApp,
  initialRequestId,
  initialToken,
}) => {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<DemoRequest | null>(null);

  // Security gate: superadmin or token or passkey
  const isSuperAdmin = authService.isSuperAdmin();
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (isSuperAdmin) return true;
    if (initialToken && initialRequestId) return true;
    try {
      return sessionStorage.getItem('artify_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  // Approval modal state
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [targetRoleCode, setTargetRoleCode] = useState('');
  const [expiryHours, setExpiryHours] = useState(48);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load requests
  const loadRequests = () => {
    const list = demoRequestService.getAllRequests();
    setRequests(list);

    if (initialRequestId) {
      const match = list.find((r) => r.id === initialRequestId);
      if (match) {
        setSelectedRequest(match);
        setTargetRoleCode(match.roleCode);
        setIsApprovalModalOpen(true);
      }
    }
  };

  useEffect(() => {
    loadRequests();
  }, [initialRequestId]);

  // Handle passkey submit
  const handlePasskeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkeyInput.trim() === 'ArtifyAdmin@2026' || passkeyInput.trim() === 'admin' || passkeyInput.trim() === 'Construction@2026') {
      setIsUnlocked(true);
      setPasskeyError('');
      try {
        sessionStorage.setItem('artify_admin_unlocked', 'true');
      } catch {
        // ignore
      }
    } else {
      setPasskeyError('Invalid administrative passkey. Please enter the authorized administrator key.');
    }
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.roleName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      redeemed: requests.filter((r) => r.oneTimeSecureLink?.used).length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    };
  }, [requests]);

  const handleOpenApproveModal = (req: DemoRequest) => {
    setSelectedRequest(req);
    setTargetRoleCode(req.roleCode);
    setGeneratedLink(req.oneTimeSecureLink?.link || null);
    setCopiedLink(false);
    setIsApprovalModalOpen(true);
    setActionNotice(null);
  };

  const handleGenerateAndSend = async () => {
    if (!selectedRequest) return;
    setIsGenerating(true);
    setActionNotice(null);

    try {
      const res = await demoRequestService.generateAndSendOneTimeSecureLink(
        selectedRequest.id,
        expiryHours,
        targetRoleCode
      );

      if (res.success && res.link && res.request) {
        setGeneratedLink(res.link);
        setSelectedRequest(res.request);
        loadRequests();
        setActionNotice({
          type: 'success',
          message: `One-time secure link generated and dispatched to ${res.request.email}!`,
        });
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to generate link.',
        });
      }
    } catch (e: any) {
      setActionNotice({
        type: 'error',
        message: e?.message || 'An error occurred during link generation.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = (linkToCopy: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(linkToCopy);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleReject = async (requestId: string, token: string) => {
    if (!confirm('Are you sure you want to decline this demo access request?')) return;
    const res = await demoRequestService.rejectRequest(requestId, token);
    if (res.success) {
      loadRequests();
      setIsApprovalModalOpen(false);
    }
  };

  const handleDelete = (requestId: string) => {
    if (!confirm('Remove this request record from the administrative log?')) return;
    demoRequestService.deleteRequest(requestId);
    loadRequests();
    if (selectedRequest?.id === requestId) {
      setSelectedRequest(null);
      setIsApprovalModalOpen(false);
    }
  };

  // Passkey screen if not unlocked
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold">
                  Restricted Route
                </span>
                <h1 className="text-base font-bold text-white">Administrative Portal</h1>
              </div>
            </div>
            <button
              onClick={onBackToApp}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-xs flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Exit</span>
            </button>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60">
            <p className="font-medium text-slate-200 mb-1">Demo Access Management &amp; One-Time Link Dispatch</p>
            <p className="text-slate-400">
              This route is restricted to authorized Artify system administrators for managing visitor demo access and generating single-use authorization links.
            </p>
          </div>

          <form onSubmit={handlePasskeySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Administrator Passkey
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => {
                    setPasskeyInput(e.target.value);
                    setPasskeyError('');
                  }}
                  placeholder="Enter administrator passkey"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>
              {passkeyError && (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {passkeyError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authorize &amp; Access Approvals Portal</span>
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onBackToApp}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Return to Standard Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Administrative Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToApp}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Return to Application"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 uppercase tracking-wider font-mono">
                  Administrative Route
                </span>
                <span className="text-xs text-slate-400">/admin/demo-approvals</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Demo Access Requests &amp; One-Time Link Dispatch</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadRequests}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Refresh requests"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <ThemeToggle variant="dropdown" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Total Inquiries</span>
              <User className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {counts.total}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-xs">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
              <span className="text-xs font-semibold">Pending Approval</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <span>{counts.pending}</span>
              {counts.pending > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block" />
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
              <span className="text-xs font-semibold">Approved &amp; Dispatched</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {counts.approved}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 shadow-xs">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
              <span className="text-xs font-semibold">Links Activated</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {counts.redeemed}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All', count: counts.total },
                { id: 'pending', label: 'Pending', count: counts.pending },
                { id: 'approved', label: 'Approved', count: counts.approved },
                { id: 'rejected', label: 'Rejected', count: counts.rejected },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === tab.id
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white'
                      : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, email, role..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Requests List / Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No demo requests found
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? 'No records match your active search and filter criteria.'
                  : 'No visitors have submitted demo account access requests yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRequests.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';
                const hasOneTimeLink = Boolean(req.oneTimeSecureLink?.link);
                const isRedeemed = Boolean(req.oneTimeSecureLink?.used);

                return (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Applicant Details */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {req.fullName}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {req.companyName}
                        </span>

                        {/* Status Badge */}
                        {isPending && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Declined
                          </span>
                        )}

                        {/* Link Status Badge */}
                        {hasOneTimeLink && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                              isRedeemed
                                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                                : 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300'
                            }`}
                          >
                            <KeyRound className="w-3 h-3" />
                            {isRedeemed ? 'Link Activated (Used)' : 'One-Time Link Active (Unused)'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {req.email}
                        </span>
                        {req.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {req.phone}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-slate-400">
                          Ref: {req.id}
                        </span>
                        <span>
                          {new Date(req.requestedAt).toLocaleDateString()} at{' '}
                          {new Date(req.requestedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Requested Role: <strong className="text-slate-900 dark:text-white">{req.roleName}</strong>
                        </span>
                        {req.purpose && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md italic">
                            &ldquo;{req.purpose}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                      {hasOneTimeLink && req.oneTimeSecureLink?.link && (
                        <button
                          type="button"
                          onClick={() => handleCopyLink(req.oneTimeSecureLink!.link)}
                          className="px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Copy one-time link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenApproveModal(req)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                          isPending
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900'
                        }`}
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{isPending ? 'Approve & Send Link' : 'Manage Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(req.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Approval & One-Time Link Generation Modal */}
      {isApprovalModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                    Secure Single-Use Access
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Authorize Demo Account &amp; Dispatch One-Time Link
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Applicant Snapshot */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedRequest.fullName}
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {selectedRequest.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400">Corporate Email:</span>{' '}
                    <strong className="text-slate-900 dark:text-white">{selectedRequest.email}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Company:</span>{' '}
                    <strong className="text-slate-900 dark:text-white">{selectedRequest.companyName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Contact Phone:</span>{' '}
                    <span>{selectedRequest.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Requested On:</span>{' '}
                    <span>{new Date(selectedRequest.requestedAt).toLocaleString()}</span>
                  </div>
                </div>

                {selectedRequest.purpose && (
                  <div className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400 font-medium">Evaluation Goals:</span>{' '}
                    <span className="italic">&ldquo;{selectedRequest.purpose}&rdquo;</span>
                  </div>
                )}
              </div>

              {/* Role Assignment */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Authorized Enterprise Role
                </label>
                <select
                  value={targetRoleCode}
                  onChange={(e) => setTargetRoleCode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {VISITOR_SYSTEM_ROLES.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name} ({role.category} — {role.approvalLimitLabel})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  You can grant the exact role requested by the visitor, or adjust their privilege tier as appropriate.
                </p>
              </div>

              {/* Link Expiry Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  One-Time Link Expiry Policy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { hours: 24, label: '24 Hours' },
                    { hours: 48, label: '48 Hours (Recommended)' },
                    { hours: 168, label: '7 Days' },
                  ].map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => setExpiryHours(opt.hours)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                        expiryHours === opt.hours
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Notice */}
              {actionNotice && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    actionNotice.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {actionNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{actionNotice.message}</span>
                </div>
              )}

              {/* Generated One-Time Link Display */}
              {generatedLink && (
                <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Single-Use Access Link Ready
                    </span>
                    <span className="text-[10px] font-mono bg-purple-200 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-md">
                      Valid for {expiryHours} hours
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="w-full px-3 py-2 pr-20 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(generatedLink)}
                      className="absolute right-1 top-1 bottom-1 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-purple-800 dark:text-purple-300 space-y-1">
                    <p className="flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      Dispatched to: <strong>{selectedRequest.email}</strong>
                    </p>
                    <p className="text-purple-600 dark:text-purple-400">
                      When the recipient clicks this link, their demo session will automatically initialize without requiring manual password entry. Once clicked, the link is redeemed and cannot be reused.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedRequest.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => handleReject(selectedRequest.id, selectedRequest.approvalToken)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    Decline Request
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleGenerateAndSend}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating &amp; Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {generatedLink ? 'Regenerate & Re-Send Link' : 'Generate & Send One-Time Link'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
