import React, { useState } from 'react';
import {
  FileSpreadsheet,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { exportToExcel } from '../../utils/exportToExcel';

export const AuditLogView: React.FC = () => {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');

  const state = accountingService.getState();

  const filteredLogs = state.auditLogs.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterEntity !== 'all' && log.entityType !== filterEntity) return false;
    return true;
  });

  const handleExportAudit = () => {
    const data = filteredLogs.map((log) => ({
      'Timestamp': log.timestamp,
      'User Name': log.userName,
      'User Role': log.userRole,
      'Action': log.action,
      'Entity Type': log.entityType,
      'Entity ID': log.entityId,
      'Reason / Note': log.reason || '—',
      'Details': JSON.stringify(log.newValues || {}),
    }));

    exportToExcel({
      filename: `Audit_Log_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Audit Trail',
      title: 'FINANCIAL SYSTEM AUDIT TRAIL & LOGS',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">System Audit Trail &amp; Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all financial events, approvals, reversals, and user activity
          </p>
        </div>

        <button
          onClick={handleExportAudit}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Export Audit Trail (Excel)
        </button>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-700">
            Total Logged Events: <span className="text-slate-900">{filteredLogs.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Actions --</option>
              <option value="CREATE">CREATE</option>
              <option value="REVERSE">REVERSE</option>
              <option value="UPDATE">UPDATE</option>
            </select>

            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Entities --</option>
              <option value="CLIENT_INVOICE">Client Invoice</option>
              <option value="PURCHASE">Purchase Bill</option>
              <option value="DIRECT_EXPENSE">Direct Expense</option>
              <option value="MONEY_IN">Money In</option>
              <option value="MONEY_OUT">Money Out</option>
              <option value="TRANSFER">Internal Transfer</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity Type</th>
                <th className="py-2.5 px-4">Entity ID</th>
                <th className="py-2.5 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {log.timestamp.replace('T', ' ').substring(0, 19)}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="font-semibold text-slate-800">{log.userName}</span>
                    <span className="text-[10px] text-slate-400 block capitalize">{log.userRole}</span>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === 'CREATE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.action === 'REVERSE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {log.entityType}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                    {log.entityId}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-sm truncate" title={log.reason}>
                    {log.reason || 'Standard system transaction posted'}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No audit logs match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogView;
