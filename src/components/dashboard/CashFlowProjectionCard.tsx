import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatOMR } from '../../utils/formatters';
import {
  calculateCashFlowProjection,
  CashFlowProjectionSummary,
  CashFlowPeriodProjection,
} from '../../utils/cashFlowProjection';
import { AppDatabaseState } from '../../services/accountingService';

interface CashFlowProjectionCardProps {
  state: AppDatabaseState;
  currentLiquidBalance: number;
}

export const CashFlowProjectionCard: React.FC<CashFlowProjectionCardProps> = ({
  state,
  currentLiquidBalance,
}) => {
  const [viewMode, setViewMode] = useState<'periodic' | 'cumulative'>('periodic');
  const [selectedPeriod, setSelectedPeriod] = useState<'30' | '60' | '90'>('30');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const projection: CashFlowProjectionSummary = calculateCashFlowProjection(
    state,
    currentLiquidBalance
  );

  // Periodic Chart Data
  const periodicChartData = projection.periods.map((p) => ({
    name: p.periodLabel,
    range: p.daysRange,
    Incoming: p.incoming,
    Outgoing: p.outgoing,
    Net: p.net,
  }));

  // Cumulative Chart Data including Day 0 (Current)
  const cumulativeChartData = [
    {
      period: 'Today (Current)',
      balance: projection.currentLiquidBalance,
      netChange: 0,
    },
    ...projection.periods.map((p) => ({
      period: p.periodLabel,
      balance: p.cumulativeBalance,
      netChange: p.net,
    })),
  ];

  const activePeriodData: CashFlowPeriodProjection =
    projection.periods.find((p) => p.periodKey === selectedPeriod) || projection.periods[0];

  // Custom tooltip for BarChart
  const renderPeriodicTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const incoming = payload.find((p: any) => p.dataKey === 'Incoming')?.value || 0;
      const outgoing = payload.find((p: any) => p.dataKey === 'Outgoing')?.value || 0;
      const net = incoming - outgoing;

      return (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-[200px]">
          <div className="font-semibold text-slate-900 dark:text-white pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>{label}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span>Incoming Funds:</span>
              <span className="font-mono font-bold">{formatOMR(incoming)}</span>
            </div>
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
              <span>Outgoing Funds:</span>
              <span className="font-mono font-bold">{formatOMR(outgoing)}</span>
            </div>
            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold">
              <span className={net >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                Net Projected Flow:
              </span>
              <span className={`font-mono ${net >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {net >= 0 ? '+' : ''}{formatOMR(net)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for Cumulative AreaChart
  const renderCumulativeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const balance = payload[0]?.value || 0;
      return (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-[200px]">
          <div className="font-semibold text-slate-900 dark:text-white pb-1 border-b border-slate-100 dark:border-slate-800">
            {label}
          </div>
          <div className="mt-2 flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span>Projected Treasury:</span>
            <span className="font-mono font-bold">{formatOMR(balance)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Cash Flow Projection (Next 30, 60, &amp; 90 Days)
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                projection.status === 'surplus'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : projection.status === 'balanced'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {projection.status === 'surplus' ? 'Surplus Runway' : projection.status === 'balanced' ? 'Balanced' : 'Deficit Risk'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time liquidity forecasting based on posted receivables, vendor payables, and recurring site expenses.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('periodic')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'periodic'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Periodic (In vs Out)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cumulative')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'cumulative'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cumulative Balance
            </button>
          </div>
        </div>
      </div>

      {/* 30 / 60 / 90 Days High-Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/30">
        {/* Next 30 Days Card */}
        <button
          type="button"
          onClick={() => setSelectedPeriod('30')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedPeriod === '30'
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Next 30 Days</span>
            <span className="text-[11px] font-mono">Days 1–30</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-base font-bold font-mono ${
                projection.periods[0].net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {projection.periods[0].net >= 0 ? '+' : ''}
              {formatOMR(projection.periods[0].net)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-emerald-600 dark:text-emerald-400">In: {formatOMR(projection.periods[0].incoming)}</span>
            <span className="text-rose-600 dark:text-rose-400">Out: {formatOMR(projection.periods[0].outgoing)}</span>
          </div>
        </button>

        {/* Next 60 Days Card */}
        <button
          type="button"
          onClick={() => setSelectedPeriod('60')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedPeriod === '60'
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Next 60 Days</span>
            <span className="text-[11px] font-mono">Days 31–60</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-base font-bold font-mono ${
                projection.periods[1].net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {projection.periods[1].net >= 0 ? '+' : ''}
              {formatOMR(projection.periods[1].net)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-emerald-600 dark:text-emerald-400">In: {formatOMR(projection.periods[1].incoming)}</span>
            <span className="text-rose-600 dark:text-rose-400">Out: {formatOMR(projection.periods[1].outgoing)}</span>
          </div>
        </button>

        {/* Next 90 Days Card */}
        <button
          type="button"
          onClick={() => setSelectedPeriod('90')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedPeriod === '90'
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Next 90 Days</span>
            <span className="text-[11px] font-mono">Days 61–90</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-base font-bold font-mono ${
                projection.periods[2].net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {projection.periods[2].net >= 0 ? '+' : ''}
              {formatOMR(projection.periods[2].net)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-emerald-600 dark:text-emerald-400">In: {formatOMR(projection.periods[2].incoming)}</span>
            <span className="text-rose-600 dark:text-rose-400">Out: {formatOMR(projection.periods[2].outgoing)}</span>
          </div>
        </button>

        {/* 90-Day Closing Treasury Position */}
        <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30">
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Closing Position</span>
            <span className="text-[11px] font-mono">Day 90 Treasury</span>
          </div>
          <div className="mt-1.5 text-base font-bold font-mono text-indigo-950 dark:text-indigo-200">
            {formatOMR(projection.projectedClosingBalance90d)}
          </div>
          <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center justify-between pt-1.5 border-t border-indigo-100 dark:border-indigo-900/60">
            <span>Net 90d: {projection.netCashFlow90d >= 0 ? '+' : ''}{formatOMR(projection.netCashFlow90d)}</span>
            <span className="font-medium">Runway: {projection.runwayDays}d</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-5">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'periodic' ? (
              <BarChart data={periodicChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={renderPeriodicTooltip} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="Incoming" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                <Bar dataKey="Outgoing" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            ) : (
              <AreaChart data={cumulativeChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis
                  dataKey="period"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={renderCumulativeTooltip} />
                <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Projected Treasury Balance (OMR)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#balanceGradient)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Selected Period Details Footer */}
      <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            Selected Period: <strong>{activePeriodData.periodLabel} ({activePeriodData.daysRange})</strong>. Projected Inflow: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{formatOMR(activePeriodData.incoming)}</span> | Projected Outflow: <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">{formatOMR(activePeriodData.outgoing)}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer self-start md:self-auto"
        >
          <span>{showBreakdown ? 'Hide Sub-ledger Details' : 'View Sub-ledger Breakdown'}</span>
          {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Breakdown Drawer */}
      {showBreakdown && (
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in fade-in">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Sub-ledger Cash Composition ({activePeriodData.periodLabel})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inflows Sub-ledger */}
            <div className="p-3.5 rounded-lg border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                  Anticipated Inflows (Client Receipts)
                </span>
                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {formatOMR(activePeriodData.incoming)}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex justify-between">
                  <span>Matured IPC Certified Receivables:</span>
                  <span className="font-mono font-medium">{formatOMR(activePeriodData.inflowDetails.receivables)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Scheduled Project Milestone Collections:</span>
                  <span className="font-mono font-medium">{formatOMR(activePeriodData.inflowDetails.milestones)}</span>
                </li>
                <li className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-emerald-100 dark:border-emerald-900/40">
                  <span>Active Posted Invoices Referenced:</span>
                  <span>{activePeriodData.inflowDetails.invoiceCount} invoices</span>
                </li>
              </ul>
            </div>

            {/* Outflows Sub-ledger */}
            <div className="p-3.5 rounded-lg border border-rose-100 dark:border-rose-950/60 bg-rose-50/30 dark:bg-rose-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-900 dark:text-rose-300">
                  Committed Outflows (Payables &amp; Direct Costs)
                </span>
                <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400">
                  {formatOMR(activePeriodData.outgoing)}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex justify-between">
                  <span>Vendor Material Payables Due:</span>
                  <span className="font-mono font-medium">{formatOMR(activePeriodData.outflowDetails.payables)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Site Direct Labor &amp; Operational Costs:</span>
                  <span className="font-mono font-medium">{formatOMR(activePeriodData.outflowDetails.operationalExpenses)}</span>
                </li>
                <li className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-rose-100 dark:border-rose-900/40">
                  <span>Active Vendor Purchase Orders Referenced:</span>
                  <span>{activePeriodData.outflowDetails.billCount} purchase bills</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
