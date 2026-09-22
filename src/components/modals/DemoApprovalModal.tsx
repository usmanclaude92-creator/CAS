import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Mail,
  Building2,
  Phone,
  Briefcase,
  ArrowRight,
  X,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { demoRequestService, DemoRequest } from '../../services/demoRequestService';

interface DemoApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string | null;
  token: string | null;
  onInstantLogin?: (email: string, roleCode: string) => void;
}

export const DemoApprovalModal: React.FC<DemoApprovalModalProps> = ({
  isOpen,
  onClose,
  requestId,
  token,
  onInstantLogin,
}) => {
  const [request, setRequest] = useState<DemoRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && requestId) {
      demoRequestService.getAllRequests().then((all) => {
        const found = all.find((r) => r.id === requestId);
        if (found) setRequest(found);
      });
    }
  }, [isOpen, requestId]);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!request) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // Generate one-time secure sign-in link via the server admin endpoint
      // (requires the current session to hold the users.create permission).
      const res = await demoRequestService.approveRequest(request.id);
      if (res.success) {
        setRequest({ ...request, status: 'approved', oneTimeSecureLink: res.link ? { link: res.link, createdAt: new Date().toISOString(), expiresAt: '', used: false, dispatchedToEmail: request.email, dispatchedAt: new Date().toISOString() } : undefined });
        setStatusMessage({
          type: 'success',
          text: `Demo access approved! A single-use secure activation link has been generated for ${request.email}.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to approve request. The token may be expired.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Network or processing error during approval.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const res = await demoRequestService.rejectRequest(request.id);
      if (res.success) {
        setRequest({ ...request, status: 'rejected' });
        setStatusMessage({
          type: 'success',
          text: 'The demo request has been marked as declined.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to decline request.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Network or processing error during decline.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Demo Access Authorization</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  Admin Review
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review visitor details and authorize temporary demo credentials
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {!request ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Request Details Not Found
              </p>
              <p>
                The specified demo request reference or authorization token could not be loaded. It may have expired or been removed.
              </p>
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-medium ${
                  request.status === 'approved'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : request.status === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {request.status === 'approved' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {request.status === 'rejected' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  {request.status === 'pending' && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span>
                    Status:{' '}
                    <strong className="capitalize">{request.status}</strong>
                    {request.status === 'pending' && ' — Awaiting Administrative Action'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  Ref: {request.id}
                </span>
              </div>

              {/* Status Toast Message */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Applicant Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>{request.fullName}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Requested: {request.roleName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{request.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{request.companyName}</span>
                  </div>
                  {request.phone && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{request.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{new Date(request.requestedAt).toLocaleString()}</span>
                  </div>
                </div>

                {request.purpose && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Evaluation Scope &amp; Purpose
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                      &quot;{request.purpose}&quot;
                    </p>
                  </div>
                )}
              </div>

              {/* If already approved, show generated one-time link or credentials */}
              {request.status === 'approved' && (
                <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      One-Time Secure Access Link Generated
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                      Dispatched
                    </span>
                  </div>

                  {request.oneTimeSecureLink?.link ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={request.oneTimeSecureLink.link}
                          className="w-full px-3 py-2 pr-20 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(request.oneTimeSecureLink!.link);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }
                          }}
                          className="absolute right-1 top-1 bottom-1 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300">
                        Dispatched to <strong>{request.email}</strong>. When clicked, this link initializes an authorized demo session for <strong>{request.roleName}</strong> automatically.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      The visitor can sign in with their authorized email (<strong>{request.email}</strong>).
                    </p>
                  )}

                  {onInstantLogin && (
                    <button
                      type="button"
                      onClick={() => onInstantLogin(request.email, request.roleCode)}
                      className="mt-2 w-full py-2 px-3 text-xs font-bold text-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Simulate Login as {request.roleName}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Close
          </button>

          {request && request.status === 'pending' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={isProcessing}
                className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              >
                Decline
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing ? 'Authorizing...' : 'Approve & Grant Demo Access'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
