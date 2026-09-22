import React, { useState } from 'react';
import { X, Database, CheckCircle, AlertCircle, Copy, Check, RefreshCw } from 'lucide-react';
import { supabaseClientManager } from '../../services/supabaseClient';
import { authService } from '../../services/authService';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({ isOpen, onClose }) => {
  const currentConfig = supabaseClientManager.getConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !authService.isSuperAdmin()) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    supabaseClientManager.updateConfig(url, anonKey);
    const result = await supabaseClientManager.testConnection();
    setTesting(false);
    setTestResult(result);
  };

  const sqlFileNotice = 'Full PostgreSQL schema migrations available in /src/supabase/migrations/ (20260914000000_initial_schema.sql & 20260914000001_audit_traceability.sql)';

  const copyNotice = () => {
    navigator.clipboard.writeText(sqlFileNotice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-800 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700/80 flex items-center justify-center">
              <Database className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Supabase PostgreSQL Configuration</h2>
              <p className="text-xs text-emerald-200">
                Production Database &amp; Storage Connection
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSaveAndTest} className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 space-y-2">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>Production Architecture Note:</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              This system uses a hybrid offline-resilient architecture: all accounting transactions process instantly in-browser with zero latency, and synchronize with your live Supabase PostgreSQL schema and Supabase Storage bucket (<code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">accounting_documents</code>).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://your-project.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Find in Supabase Dashboard &gt; Project Settings &gt; API
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Supabase Anon / Public Key
            </label>
            <textarea
              rows={3}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Safe for browser queries guarded by Row Level Security (RLS) policies.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="bg-slate-100 p-3 rounded-lg flex items-center justify-between text-xs">
            <span className="text-slate-600 font-mono text-[11px]">
              Migrations: /src/supabase/migrations/
            </span>
            <button
              type="button"
              onClick={copyNotice}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Path'}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors cursor-pointer shadow disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing Supabase...
                </>
              ) : (
                'Save & Test Connection'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupabaseSettingsModal;
