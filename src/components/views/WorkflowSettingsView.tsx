import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Scale,
  Users,
} from 'lucide-react';
import { WorkflowSettings } from '../../types/auth';
import { authService } from '../../services/authService';

export const WorkflowSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<WorkflowSettings>(authService.getWorkflowSettings());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canEdit = authService.hasPermission('settings.edit') || authService.isSuperAdmin();

  useEffect(() => {
    setSettings(authService.getWorkflowSettings());
  }, []);

  const handleLimitChange = (roleCode: string, amount: number) => {
    setSettings({
      ...settings,
      approvalLimits: settings.approvalLimits.map((l) =>
        l.roleCode === roleCode ? { ...l, maxAmountOMR: amount } : l
      ),
    });
  };

  const handleSave = () => {
    setFeedback(null);
    const res = authService.updateWorkflowSettings(settings);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Workflow approval limits and Separation of Duties policy updated successfully.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to save workflow settings.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Workflow, Approval Limits &amp; SOD Governance</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure transaction approval thresholds, authority caps, and maker-checker Separation of Duties.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Governance Policy</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <div>
            <strong className="font-semibold block">
              {feedback.type === 'success' ? 'Settings Saved' : 'Update Failed'}
            </strong>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Separation of Duties Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Maker-Checker &bull; Separation of Duties (SOD)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prevents fraud by ensuring the user who creates/submits a transaction cannot approve it.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={settings.separationOfDutiesEnabled}
              onChange={(e) =>
                setSettings({ ...settings, separationOfDutiesEnabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p className="font-semibold text-slate-900 dark:text-white">
            Current Status: {settings.separationOfDutiesEnabled ? 'ENFORCED' : 'OPTIONAL'}
          </p>
          <p>
            When enforced, any approval request created by a user will automatically block that same user from executing the final approval action, even if their role permits it. The transaction must be approved by another authorized team member.
          </p>
        </div>
      </div>

      {/* Role Approval Thresholds Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Role-Based Financial Approval Thresholds (OMR)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transactions with total amount exceeding the role threshold will require escalation to higher management.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Role Code</th>
                <th className="px-4 py-3">Role Name</th>
                <th className="px-4 py-3 text-right">Max Authority Limit (OMR 18,3)</th>
                <th className="px-4 py-3">Governance Escalation Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {settings.approvalLimits.map((limit) => {
                const isSuper = limit.roleCode === 'super_admin';
                const isViewer = limit.roleCode === 'viewer';

                return (
                  <tr key={limit.roleCode} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                      {limit.roleCode}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {limit.roleName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSuper ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                          Unrestricted (OMR 999,999,999.000)
                        </span>
                      ) : isViewer ? (
                        <span className="font-semibold text-slate-400 font-mono">
                          OMR 0.000 (Read Only)
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <span className="font-mono text-slate-400">OMR</span>
                          <input
                            type="number"
                            step="100"
                            disabled={!canEdit}
                            value={limit.maxAmountOMR}
                            onChange={(e) =>
                              handleLimitChange(limit.roleCode, parseFloat(e.target.value) || 0)
                            }
                            className="w-32 text-right p-1.5 font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {isSuper
                        ? 'Highest executive board sign-off'
                        : isViewer
                        ? 'No approval authority permitted'
                        : `Amounts above OMR ${limit.maxAmountOMR.toFixed(3)} escalate to Finance or Accounts Manager`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WorkflowSettingsView;
