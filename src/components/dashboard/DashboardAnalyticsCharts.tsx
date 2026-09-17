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
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Scale,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { formatOMR, formatPercent } from '../../utils/formatters';

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  cost: number;
  collections: number;
  margin: number;
}

export interface CostCategoryPoint {
  name: string;
  value: number;
  color: string;
}

export interface ProjectMarginPoint {
  name: string;
  code: string;
  contract: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface BudgetVariancePoint {
  name: string;
  Budget: number;
  Actual: number;
  Variance: number;
}

interface DashboardAnalyticsChartsProps {
  scope: 'overall' | 'project';
  projectName?: string;
  projectCode?: string;
  monthlyTrend: MonthlyTrendPoint[];
  costDistribution: CostCategoryPoint[];
  projectMargins: ProjectMarginPoint[];
  budgetVsActuals: BudgetVariancePoint[];
  totalProjectCost: number;
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const DashboardAnalyticsCharts: React.FC<DashboardAnalyticsChartsProps> = ({
  scope,
  projectName,
  projectCode,
  monthlyTrend,
  costDistribution,
  projectMargins,
  budgetVsActuals,
  totalProjectCost,
}) => {
  const [activeTab, setActiveTab] = useState<'trend' | 'cost' | 'margins' | 'budget'>('trend');

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 space-y-4 transition-colors">
      {/* Chart Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Interactive Financial &amp; Cost Analytics</span>
            {scope === 'project' && projectCode && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {projectCode}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {scope === 'overall'
              ? 'Consolidated visual analysis of revenue recognition, cost incurrence, and profit margins'
              : `Deep-dive analytics for ${projectName || 'Selected Project'}`}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('trend')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'trend'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Monthly Trend</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cost')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'cost'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>Cost Structure</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('margins')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'margins'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{scope === 'overall' ? 'Project Margins' : 'Financial Flow'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'budget'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Budget vs Actual</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Monthly Financial Trend (Revenue vs Cost vs Collections) */}
      {activeTab === 'trend' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Grouped monthly trajectory: Invoiced Revenue, Direct Incurred Cost, and Cash Collections</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Revenue
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Incurred Cost
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Collections
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${formatOMR(Number(value))}`,
                    name === 'revenue'
                      ? 'Invoiced Revenue'
                      : name === 'cost'
                      ? 'Direct Cost'
                      : name === 'collections'
                      ? 'Cash Collected'
                      : name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="cost" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="collections" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 2: Cost Structure & Distribution Donut Chart */}
      {activeTab === 'cost' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-64 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {costDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${formatOMR(Number(val))}`, 'Cost Amount']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Stat */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-medium text-slate-400">Total Cost</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatOMR(totalProjectCost)}
              </span>
            </div>
          </div>

          {/* Cost Items Legend List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Expense Head &amp; Bill Breakdown
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {costDistribution.map((item, idx) => {
                const percent = totalProjectCost > 0 ? (item.value / totalProjectCost) * 100 : 0;
                return (
                  <div key={item.name} className="py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color || PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 block">
                        {formatOMR(item.value)}
                      </span>
                      <span className="text-[10px] text-slate-400">{percent.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Project Margins & Profitability Ranking */}
      {activeTab === 'margins' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {scope === 'overall'
                ? 'Gross profit comparison and profit margins across active construction projects'
                : 'Project Financial Flow: Contract vs Invoiced vs Collected vs Actual Cost vs Gross Profit'}
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Gross Profit</span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectMargins} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any, props: any) => [
                    `${formatOMR(Number(value))} (${props.payload.margin ? props.payload.margin.toFixed(1) : 0}%)`,
                    props.payload.name || name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 4: Budget vs Actuals & Variance Analysis */}
      {activeTab === 'budget' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Approved Budget Cost baseline compared against Actual Incurred Cost to date</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" /> Approved Budget
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Actual Cost
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsActuals} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [`${formatOMR(Number(value))}`, name]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Budget" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
