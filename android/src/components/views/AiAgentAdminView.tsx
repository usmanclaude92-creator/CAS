import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Power,
  ListChecks,
  Clock,
  Bell,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { aiAdminService, type AiActionAuditRow, type AiPendingActionRow, type AiRuntimeSettings } from '../../services/aiAdminService';
import { aiAutomationsService, type AiAutomation } from '../../services/aiAutomationsService';

type Tab = 'kill_switch' | 'actions' | 'pending' | 'automations';

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'kill_switch', label: 'Kill Switch', icon: Power },
  { id: 'actions', label: 'Action Audit', icon: ListChecks },
  { id: 'pending', label: 'Pending Confirmations', icon: Clock },
  { id: 'automations', label: 'Automations', icon: Bell },
];

const CARD = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs';
const RISK_BADGE: Record<string, string> = {
  low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  medium: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
  high: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300',
};

/**
 * Human oversight for the Phase 5 AI action subsystem (docs/ai/CAS-AI-PHASE-5.md
 * §Human oversight). Gated entirely by permission upstream (App.tsx's
 * verifyViewPermission requires ai_actions.manage, mirroring every other
 * admin-only view in this app) — this component assumes access is already
 * granted. Every control here calls a real server endpoint that
 * independently re-checks ai_actions.manage (defense in depth); nothing
 * here is a client-side-only toggle.
 */
export const AiAgentAdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('kill_switch');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>AI Agent Administration</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Oversight for the AI Agent&rsquo;s controlled actions and automations — emergency kill switch, action audit trail, pending confirmations, and scheduled reminders.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap cursor-pointer transition-colors ${
                isActive
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'kill_switch' && <KillSwitchTab />}
      {activeTab === 'actions' && <RecentActionsTab />}
      {activeTab === 'pending' && <PendingActionsTab />}
      {activeTab === 'automations' && <AutomationsTab />}
    </div>
  );
};

function EmptyState({ icon: Icon, title, description }: { icon: React.FC<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="p-12 text-center space-y-3">
      <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

// --- Kill Switch ----------------------------------------------------------

function KillSwitchTab() {
  const [settings, setSettings] = useState<AiRuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await aiAdminService.getKillSwitch();
    setSettings(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (field: 'actionsEnabled' | 'automationsEnabled') => {
    if (!settings || saving) return;
    setSaving(true);
    setError(null);
    const result = await aiAdminService.updateKillSwitch({ [field]: !settings[field] });
    setSaving(false);
    if (result.success === false) {
      setError(result.error || 'Failed to update.');
      return;
    }
    if (result.settings) setSettings(result.settings);
  };

  if (loading) {
    return (
      <div className={`${CARD} p-12 flex items-center justify-center`}>
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!settings) {
    return (
      <div className={CARD}>
        <EmptyState icon={AlertTriangle} title="Could not load AI runtime settings" description="Reload the page or check server configuration." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className={`${CARD} p-5 flex items-start justify-between gap-4`}>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Emergency AI Action Kill Switch
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            When off, every AI action tool (low, medium, and high risk) refuses to run for every user, immediately, server-side. Read-only chat, RAG, voice, and multimodal understanding are unaffected.
          </p>
        </div>
        <ToggleSwitch checked={settings.actionsEnabled} disabled={saving} onChange={() => void toggle('actionsEnabled')} label="AI actions enabled" />
      </div>

      <div className={`${CARD} p-5 flex items-start justify-between gap-4`}>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Automations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            When off, the scheduled automation runner sends no reminder notifications for any user, even if individual automations remain enabled.
          </p>
        </div>
        <ToggleSwitch checked={settings.automationsEnabled} disabled={saving} onChange={() => void toggle('automationsEnabled')} label="Automations enabled" />
      </div>

      {settings.disabledActionTools.length > 0 && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Individually Disabled Action Tools</h3>
          <div className="flex flex-wrap gap-1.5">
            {settings.disabledActionTools.map((name) => (
              <span key={name} className="text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, disabled, onChange, label }: { checked: boolean; disabled: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`shrink-0 relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

// --- Recent Actions ---------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  executed: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
  validation_failed: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
  authorization_failed: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300',
  execution_failed: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300',
  timeout: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300',
};

function RecentActionsTab() {
  const [actions, setActions] = useState<AiActionAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setActions(await aiAdminService.getRecentActions(100));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Most recent 100 executions across every user</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : actions.length === 0 ? (
        <EmptyState icon={ListChecks} title="No AI actions recorded yet" description="Executed action-tool calls (create/update/etc.) will appear here as they happen." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Confirmation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {actions.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(a.executed_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-100">{a.tool_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${RISK_BADGE[a.risk_level] ?? ''}`}>{a.risk_level}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 capitalize">{a.confirmation_status.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_BADGE[a.status] ?? ''}`}>{a.status.replace('_', ' ')}</span>
                    {a.error_message && <div className="text-[10px] text-rose-500 mt-0.5 max-w-[240px] truncate">{a.error_message}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{a.duration_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Pending Confirmations ---------------------------------------------------

function PendingActionsTab() {
  const [pending, setPending] = useState<AiPendingActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPending(await aiAdminService.getPendingActions());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setRevokingId(id);
    const result = await aiAdminService.revokePendingAction(id);
    setRevokingId(null);
    if (result.success) setPending((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Awaiting confirmation, across every user</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : pending.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing pending" description="No user currently has an unconfirmed AI action awaiting their decision." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {pending.map((p) => (
            <li key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100">{p.tool_name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${RISK_BADGE[p.risk_level] ?? ''}`}>{p.risk_level}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">{p.preview?.summary}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Proposed {new Date(p.created_at).toLocaleString()} · expires {new Date(p.expires_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={revokingId === p.id}
                onClick={() => void revoke(p.id)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                {revokingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Automations ---------------------------------------------------------

function AutomationsTab() {
  const [automations, setAutomations] = useState<AiAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [intervalHours, setIntervalHours] = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    setAutomations(await aiAutomationsService.list());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setFormError(null);
    if (!name.trim() || !notifyTitle.trim() || !notifyMessage.trim()) {
      setFormError('All fields are required.');
      return;
    }
    setCreating(true);
    const result = await aiAutomationsService.create({ name: name.trim(), notifyTitle: notifyTitle.trim(), notifyMessage: notifyMessage.trim(), intervalHours });
    setCreating(false);
    if (result.success === false) {
      setFormError(result.error || 'Failed to create automation.');
      return;
    }
    setName('');
    setNotifyTitle('');
    setNotifyMessage('');
    setIntervalHours(24);
    setShowForm(false);
    void load();
  };

  const toggleEnabled = async (a: AiAutomation) => {
    await aiAutomationsService.update(a.id, { enabled: !a.enabled });
    void load();
  };

  const remove = async (id: string) => {
    await aiAutomationsService.remove(id);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Reminder Automation
        </button>
      </div>

      {showForm && (
        <div className={`${CARD} p-4 space-y-3`}>
          {formError && <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs" />
            </label>
            <label className="text-xs">
              <span className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Repeat every (hours)</span>
              <input
                type="number"
                min={1}
                max={8760}
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              />
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Notification title</span>
              <input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} maxLength={255} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs" />
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Notification message</span>
              <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} maxLength={1000} rows={2} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : automations.length === 0 ? (
          <EmptyState icon={Bell} title="No automations yet" description="Create a scheduled reminder above — it will notify you on its own repeat interval until disabled or deleted." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {automations.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{a.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        a.enabled ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {a.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {a.consecutiveFailureCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {a.consecutiveFailureCount} recent failure{a.consecutiveFailureCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    &ldquo;{a.notifyTitle}&rdquo; every {a.intervalHours}h · next {new Date(a.nextRunAt).toLocaleString()}
                    {a.lastRunAt ? ` · last ran ${new Date(a.lastRunAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button type="button" onClick={() => void toggleEnabled(a)} className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer">
                    {a.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(a.id)}
                    aria-label={`Delete automation ${a.name}`}
                    className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AiAgentAdminView;
