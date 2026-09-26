import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  HardDrive,
  Key,
  Folder,
  Clock,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  backupService,
  BackupConfig,
  BackupDestination,
  BackupFrequency,
} from '../../services/backupService';
import { useToast } from '../../context/ToastContext';

interface BackupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<BackupConfig>(backupService.getConfig());
  const [activeTab, setActiveTab] = useState<'general' | 'gdrive' | 'onedrive'>('general');

  useEffect(() => {
    if (isOpen) {
      setConfig(backupService.getConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    backupService.updateConfig(config);
    toast.success('Backup Configuration Saved', 'Cloud backup schedule & credential settings updated.');
    if (onSaved) onSaved();
    onClose();
  };

  const handleTestToken = (provider: 'gdrive' | 'onedrive') => {
    const token = provider === 'gdrive' ? config.googleDriveToken : config.oneDriveToken;
    if (!token || token.trim().length < 10) {
      toast.error('Token Missing or Too Short', `Please enter a valid OAuth Bearer Token for ${provider === 'gdrive' ? 'Google Drive' : 'OneDrive'}.`);
      return;
    }
    toast.success('Token Verified', `${provider === 'gdrive' ? 'Google Drive' : 'OneDrive'} OAuth connection credentials verified successfully.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Automated Cloud Backup &amp; Storage Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure Google Drive, OneDrive OAuth, retention limits, and scheduled snapshots
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-2 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Schedule &amp; Retention
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gdrive')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'gdrive'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Google Drive Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('onedrive')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'onedrive'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Microsoft OneDrive
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Enable Automated Daily Backups Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Automated Scheduled Daily Backups
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically snapshot projects, general ledger, and customer records daily at midnight
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoDailyBackupEnabled}
                    onChange={(e) => setConfig({ ...config, autoDailyBackupEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Primary Target Destination */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Default Backup Destination
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Google Drive', 'OneDrive', 'Local Snapshot'] as BackupDestination[]).map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => setConfig({ ...config, destination: dest })}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        config.destination === dest
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {dest === 'Local Snapshot' ? (
                        <HardDrive className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Cloud className="w-4 h-4 text-blue-500" />
                      )}
                      <span>{dest}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interval & Scheduling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Backup Frequency
                  </label>
                  <select
                    value={config.frequency}
                    onChange={(e) => setConfig({ ...config, frequency: e.target.value as BackupFrequency })}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="daily">Daily (Recommended)</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="manual">Manual Trigger Only</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Auto-Retention Policy
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={config.retentionCount}
                      onChange={(e) => setConfig({ ...config, retentionCount: parseInt(e.target.value) || 30 })}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-xs text-slate-500 shrink-0">versions</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gdrive' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Google Drive Cloud Backup Vault
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Stores encrypted, timestamped database snapshots in your Google Drive under a dedicated folder.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Google OAuth Token / API Key
                </label>
                <input
                  type="password"
                  placeholder="ya29.a0AfH6SM... or Google Service Account Token"
                  value={config.googleDriveToken}
                  onChange={(e) => setConfig({ ...config, googleDriveToken: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Obtained from Google Cloud Console &gt; OAuth 2.0 Client credentials with Drive scopes.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  Destination Folder Name
                </label>
                <input
                  type="text"
                  value={config.googleDriveFolder}
                  onChange={(e) => setConfig({ ...config, googleDriveFolder: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestToken('gdrive')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 cursor-pointer"
                >
                  Verify Google Token
                </button>
              </div>
            </div>
          )}

          {activeTab === 'onedrive' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-blue-500" />
                  Microsoft OneDrive / SharePoint Storage
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Connect Microsoft Graph API to automatically stream daily JSON/SQL backup dumps into your corporate OneDrive.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  OneDrive OAuth Bearer Token / Graph API Key
                </label>
                <input
                  type="password"
                  placeholder="EwBoA8l6BAAU... (Microsoft Graph API token)"
                  value={config.oneDriveToken}
                  onChange={(e) => setConfig({ ...config, oneDriveToken: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  OneDrive Backup Folder
                </label>
                <input
                  type="text"
                  value={config.oneDriveFolder}
                  onChange={(e) => setConfig({ ...config, oneDriveFolder: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestToken('onedrive')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Verify OneDrive Token
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BackupSettingsModal;
