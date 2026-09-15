import React from 'react';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { NavView } from './Sidebar';
import { accountingService } from '../services/accountingService';

interface BreadcrumbsProps {
  activeView: NavView;
  selectedProjectId?: string | null;
  selectedCustomerId?: string | null;
  selectedVendorId?: string | null;
  onNavigateView: (view: NavView) => void;
  onClearProject?: () => void;
  onClearCustomer?: () => void;
  onClearVendor?: () => void;
}

interface BreadcrumbStep {
  label: string;
  onClick?: () => void;
  isCurrent?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  activeView,
  selectedProjectId,
  selectedCustomerId,
  selectedVendorId,
  onNavigateView,
  onClearProject,
  onClearCustomer,
  onClearVendor,
}) => {
  const state = accountingService.getState();

  // Determine breadcrumb trail steps
  const steps: BreadcrumbStep[] = [];

  // Always start with Dashboard if not currently on dashboard
  const isDashboard = activeView === 'dashboard';

  steps.push({
    label: 'Dashboard',
    onClick: isDashboard ? undefined : () => {
      if (onClearProject) onClearProject();
      if (onClearCustomer) onClearCustomer();
      if (onClearVendor) onClearVendor();
      onNavigateView('dashboard');
    },
    isCurrent: isDashboard,
  });

  if (!isDashboard) {
    switch (activeView) {
      case 'projects': {
        const isDetail = Boolean(selectedProjectId);
        steps.push({
          label: 'Projects & Costing',
          onClick: isDetail ? () => {
            if (onClearProject) onClearProject();
          } : undefined,
          isCurrent: !isDetail,
        });

        if (isDetail && selectedProjectId) {
          const project = state.projects.find((p) => p.id === selectedProjectId);
          steps.push({
            label: project ? `${project.name} (${project.code})` : 'Project Detail',
            isCurrent: true,
          });
        }
        break;
      }

      case 'project_dashboard': {
        steps.push({
          label: 'Projects & Costing',
          onClick: () => {
            onNavigateView('projects');
          },
          isCurrent: false,
        });

        const project = selectedProjectId
          ? state.projects.find((p) => p.id === selectedProjectId)
          : null;

        steps.push({
          label: project ? `${project.name} (Executive Dashboard)` : 'Project Executive Dashboard',
          isCurrent: true,
        });
        break;
      }

      case 'customers': {
        const isDetail = Boolean(selectedCustomerId);
        steps.push({
          label: 'Clients & Receivables',
          onClick: isDetail ? () => {
            if (onClearCustomer) onClearCustomer();
          } : undefined,
          isCurrent: !isDetail,
        });

        if (isDetail && selectedCustomerId) {
          const customer = state.customers.find((c) => c.id === selectedCustomerId);
          steps.push({
            label: customer ? `${customer.name} (${customer.code})` : 'Client Account',
            isCurrent: true,
          });
        }
        break;
      }

      case 'purchases': {
        const isDetail = Boolean(selectedVendorId);
        steps.push({
          label: 'Vendors & Payables',
          onClick: isDetail ? () => {
            if (onClearVendor) onClearVendor();
          } : undefined,
          isCurrent: !isDetail,
        });

        if (isDetail && selectedVendorId) {
          const vendor = state.vendors.find((v) => v.id === selectedVendorId);
          steps.push({
            label: vendor ? `${vendor.name} (${vendor.code})` : 'Vendor Account',
            isCurrent: true,
          });
        }
        break;
      }

      case 'banking':
        steps.push({ label: 'Banking & Treasury', isCurrent: true });
        break;

      case 'expenses':
        steps.push({ label: 'Direct Site Expenses', isCurrent: true });
        break;

      case 'approvals':
        steps.push({ label: 'Pending Approvals', isCurrent: true });
        break;

      case 'reports':
        steps.push({ label: 'Financial Reports & Statements', isCurrent: true });
        break;

      case 'masters':
        steps.push({ label: 'Masters & Setup', isCurrent: true });
        break;

      case 'users':
        steps.push({ label: 'User Directory', isCurrent: true });
        break;

      case 'roles':
        steps.push({ label: 'Roles & RBAC', isCurrent: true });
        break;

      case 'workflow_settings':
        steps.push({ label: 'Approval Governance & Thresholds', isCurrent: true });
        break;

      case 'master_import_audit':
        steps.push({ label: 'Master Import Audit Trail', isCurrent: true });
        break;

      case 'audit':
        steps.push({ label: 'Immutable Audit Log', isCurrent: true });
        break;

      default:
        steps.push({ label: activeView, isCurrent: true });
        break;
    }
  }

  // Find direct parent step to power a quick "Back" link when deep in hierarchy
  const parentStep = steps.length > 1 ? steps[steps.length - 2] : null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center justify-between gap-3 text-xs bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs print:hidden transition-colors"
    >
      <ol className="flex items-center flex-wrap gap-1.5 min-w-0">
        {steps.map((step, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === steps.length - 1;

          return (
            <li key={`${step.label}-${idx}`} className="flex items-center gap-1.5 min-w-0">
              {!isFirst && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              )}

              {step.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={step.onClick}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium transition-colors cursor-pointer truncate max-w-[180px] sm:max-w-[240px]"
                >
                  {isFirst && <Home className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{step.label}</span>
                </button>
              ) : (
                <div
                  className={`flex items-center gap-1.5 truncate max-w-[220px] sm:max-w-[360px] ${
                    isLast
                      ? 'font-bold text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {isFirst && <Home className="w-3.5 h-3.5 shrink-0 text-slate-700 dark:text-slate-200" />}
                  <span className="truncate" title={step.label}>
                    {step.label}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Quick Back to Parent button when inside nested views */}
      {parentStep && parentStep.onClick && (
        <button
          type="button"
          onClick={parentStep.onClick}
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
          title={`Go back to ${parentStep.label}`}
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to {parentStep.label}</span>
        </button>
      )}
    </nav>
  );
};
