import React, { useState } from 'react';
import { CheckCircle2, Play, Sparkles, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { accountingService } from '../services/accountingService';
import { formatOMR } from '../utils/formatters';

interface AcceptanceTestBannerProps {
  onOpenProjectView?: (projectId: string) => void;
}

export const AcceptanceTestBanner: React.FC<AcceptanceTestBannerProps> = ({ onOpenProjectView }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const state = accountingService.getState();
  const testProject = state.projects.find((p) => p.code === 'PRJ-AKV-001') || state.projects[0];
  const testCustomer = state.customers.find((c) => c.code === 'CUST-001') || state.customers[0];
  const testVendor = state.vendors.find((v) => v.code === 'VEND-001') || state.vendors[0];

  const profitability = testProject ? accountingService.getProjectProfitability(testProject.id) : null;
  const customerLedger = testCustomer ? accountingService.getCustomerLedger(testCustomer.id) : [];
  const vendorLedger = testVendor ? accountingService.getVendorLedger(testVendor.id) : [];

  const customerOutstanding = customerLedger.length > 0 ? customerLedger[customerLedger.length - 1].outstanding : 0;
  const vendorOutstanding = vendorLedger.length > 0 ? vendorLedger[vendorLedger.length - 1].outstanding : 0;

  // Acceptance Test Targets (Prompt #49):
  // Customer: Invoice 10,000 | Received 5,000 | Outstanding 5,000
  // Vendor: Purchase 3,000 | Paid 1,000 | Outstanding 2,000
  // Project: Revenue 10,000 | Project Cost 3,050 | Project Profit 6,950
  const isCustomerValid = profitability && customerOutstanding === 5000;
  const isVendorValid = vendorOutstanding === 2000;
  const isProjectRevenueValid = profitability && profitability.totalInvoiced === 10000;
  const isProjectCostValid = profitability && profitability.totalProjectCost === 3050;
  const isProjectProfitValid = profitability && profitability.grossProfit === 6950;

  const allPassed =
    isCustomerValid &&
    isVendorValid &&
    isProjectRevenueValid &&
    isProjectCostValid &&
    isProjectProfitValid;

  const handleRunTest = () => {
    setIsRunning(true);
    setTimeout(() => {
      try {
        accountingService.executeAcceptanceTestScenario();
        setIsSuccess(true);
      } finally {
        setIsRunning(false);
      }
    }, 400);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white shadow-lg mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Prompt Acceptance Test #49
            </span>
            <h3 className="text-sm font-semibold tracking-wide text-slate-100">
              Al Khoudh Villa Project — Financial Accounting Validation
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Validates automatic single-entry multi-ledger accounting, zero double-counting, and real-time OMR balance calculations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunTest}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Run Acceptance Test (1-Click)
          </button>
          {testProject && onOpenProjectView && (
            <button
              onClick={() => onOpenProjectView(testProject.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              View Project
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Acceptance Metric Comparison Table */}
      <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium">Customer Receivable</div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">
            {formatOMR(customerOutstanding)}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {isCustomerValid ? (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Target: OMR 5,000.000
              </span>
            ) : (
              <span>Target: OMR 5,000.000</span>
            )}
          </div>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium">Vendor Payable</div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">
            {formatOMR(vendorOutstanding)}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {isVendorValid ? (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Target: OMR 2,000.000
              </span>
            ) : (
              <span>Target: OMR 2,000.000</span>
            )}
          </div>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium">Project Revenue</div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">
            {profitability ? formatOMR(profitability.totalInvoiced) : 'OMR 0.000'}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {isProjectRevenueValid ? (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Target: OMR 10,000.000
              </span>
            ) : (
              <span>Target: OMR 10,000.000</span>
            )}
          </div>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium">Project Cost</div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">
            {profitability ? formatOMR(profitability.totalProjectCost) : 'OMR 0.000'}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {isProjectCostValid ? (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Target: OMR 3,050.000
              </span>
            ) : (
              <span>Target: OMR 3,050.000</span>
            )}
          </div>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 col-span-2 sm:col-span-1">
          <div className="text-[11px] text-slate-400 font-medium">Project Profit</div>
          <div className="text-sm font-semibold text-emerald-400 mt-0.5">
            {profitability ? formatOMR(profitability.grossProfit) : 'OMR 0.000'}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
            {isProjectProfitValid ? (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Target: OMR 6,950.000
              </span>
            ) : (
              <span>Target: OMR 6,950.000</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptanceTestBanner;
