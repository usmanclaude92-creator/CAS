import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { MasterImportAuditRecord } from '../../types/auth';
import { authService } from '../../services/authService';

export const MasterImportAuditView: React.FC = () => {
  const [auditList, setAuditList] = useState<MasterImportAuditRecord[]>([]);

  const reloadData = () => {
    setAuditList(authService.getMasterImportAudits());
  };

  useEffect(() => {
    reloadData();
    const unsub = authService.subscribe(reloadData);
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Master-Data Import Governance &amp; Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mandatory audit records for all Super Administrator bulk imports across customers, vendors, and projects.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Restricted to Super Administrator</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {auditList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Master Imports Recorded Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              When a Super Administrator imports Customers, Vendors, Projects, or Banks, the complete batch telemetry will be logged here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Imported By</th>
                  <th className="px-4 py-3 text-center">Total Rows</th>
                  <th className="px-4 py-3 text-center">New Records</th>
                  <th className="px-4 py-3 text-center">Duplicates Skipped</th>
                  <th className="px-4 py-3 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditList.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(rec.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                      {rec.importType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                      {rec.fileName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {rec.importedByUserName}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {rec.importedByUserEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {rec.totalRows}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{rec.newRecords}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {rec.duplicateRecords}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          rec.result === 'success'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {rec.result === 'success' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3" /> Partial
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterImportAuditView;
