import React from 'react';
import { DashboardView } from './DashboardView';

export interface ProjectDashboardViewProps {
  initialProjectId?: string | null;
  onNavigateToProjectsList?: (projectId?: string) => void;
  onOpenClientInvoice: (projectId?: string) => void;
  onOpenPurchase: (projectId?: string) => void;
  onOpenExpense: (projectId?: string) => void;
  onOpenMoneyIn: (projectId?: string) => void;
  onOpenMoneyOut?: () => void;
  onOpenTransfer?: () => void;
}

/**
 * Consolidated Project Dashboard
 * Forward-compatible adapter rendering the unified Dashboard in 'project' scope
 */
export const ProjectDashboardView: React.FC<ProjectDashboardViewProps> = ({
  initialProjectId,
  onNavigateToProjectsList,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenMoneyIn,
  onOpenMoneyOut = () => {},
  onOpenTransfer,
}) => {
  return (
    <DashboardView
      initialScope="project"
      initialProjectId={initialProjectId}
      onNavigateToProjectsList={onNavigateToProjectsList}
      onOpenClientInvoice={onOpenClientInvoice}
      onOpenPurchase={onOpenPurchase}
      onOpenExpense={onOpenExpense}
      onOpenMoneyIn={onOpenMoneyIn}
      onOpenMoneyOut={onOpenMoneyOut}
      onOpenTransfer={onOpenTransfer}
    />
  );
};

export default ProjectDashboardView;
