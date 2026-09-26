import { AppDatabaseState } from '../services/accountingService';
import { addMoney, subtractMoney } from './formatters';

export interface CashFlowPeriodProjection {
  periodKey: '30' | '60' | '90';
  periodLabel: string;
  daysRange: string;
  incoming: number;
  outgoing: number;
  net: number;
  cumulativeBalance: number;
  inflowDetails: {
    receivables: number;
    milestones: number;
    invoiceCount: number;
  };
  outflowDetails: {
    payables: number;
    operationalExpenses: number;
    billCount: number;
  };
}

export interface CashFlowProjectionSummary {
  currentLiquidBalance: number;
  periods: CashFlowPeriodProjection[];
  totalIncoming90d: number;
  totalOutgoing90d: number;
  netCashFlow90d: number;
  projectedClosingBalance90d: number;
  burnRatePerDay: number;
  runwayDays: number;
  status: 'surplus' | 'balanced' | 'deficit';
  statusDescription: string;
}

export function calculateCashFlowProjection(
  state: AppDatabaseState,
  currentLiquidBalance: number
): CashFlowProjectionSummary {
  const postedInvoices = state.clientInvoices.filter(
    (inv) => inv.status === 'posted' || inv.status === 'partially_paid' || inv.status === 'unpaid'
  );

  const postedPurchases = state.purchases.filter(
    (p) => p.status === 'posted' || p.status === 'partially_paid' || p.status === 'unpaid'
  );

  const postedExpenses = state.directExpenses.filter(
    (e) => e.status === 'posted'
  );

  // Compute daily run rate for recurring site expenses based on past 30 days or average
  const totalDirectExpenses = postedExpenses.reduce((acc, e) => addMoney(acc, e.amount), 0);
  const monthlyRunRateExpense = totalDirectExpenses > 0 ? totalDirectExpenses / 3 : 4500;

  // Outstanding receivables and payables
  const totalReceivable = postedInvoices.reduce(
    (acc, inv) => addMoney(acc, inv.outstandingAmount ?? Math.max(0, inv.amount - (inv.receivedAmount || 0))),
    0
  );

  const totalPayable = postedPurchases.reduce(
    (acc, p) => addMoney(acc, p.outstandingAmount ?? Math.max(0, p.amount - (p.paidAmount || 0))),
    0
  );

  // Distribute across 30, 60, 90 days buckets based on realistic construction billing & payment cycles:
  // Month 1 (30 days): immediate invoices due (50% of outstanding) + milestone IPCs
  // Month 2 (60 days): next billing cycle receivables (35% of outstanding)
  // Month 3 (90 days): retention & quarterly billing (15% of outstanding)
  const incoming30 = Math.round((totalReceivable * 0.50 + 12000) * 1000) / 1000;
  const incoming60 = Math.round((totalReceivable * 0.35 + 18000) * 1000) / 1000;
  const incoming90 = Math.round((totalReceivable * 0.15 + 24000) * 1000) / 1000;

  // Payables distribution:
  // Month 1 (30 days): 55% of vendor payables + 1 month site expenses
  // Month 2 (60 days): 30% of vendor payables + 1 month site expenses
  // Month 3 (90 days): 15% of vendor payables + 1 month site expenses
  const outgoing30 = Math.round((totalPayable * 0.55 + monthlyRunRateExpense) * 1000) / 1000;
  const outgoing60 = Math.round((totalPayable * 0.30 + monthlyRunRateExpense) * 1000) / 1000;
  const outgoing90 = Math.round((totalPayable * 0.15 + monthlyRunRateExpense) * 1000) / 1000;

  const net30 = subtractMoney(incoming30, outgoing30);
  const bal30 = addMoney(currentLiquidBalance, net30);

  const net60 = subtractMoney(incoming60, outgoing60);
  const bal60 = addMoney(bal30, net60);

  const net90 = subtractMoney(incoming90, outgoing90);
  const bal90 = addMoney(bal60, net90);

  const periods: CashFlowPeriodProjection[] = [
    {
      periodKey: '30',
      periodLabel: 'Next 30 Days',
      daysRange: 'Days 1 – 30',
      incoming: incoming30,
      outgoing: outgoing30,
      net: net30,
      cumulativeBalance: bal30,
      inflowDetails: {
        receivables: Math.round(totalReceivable * 0.50 * 1000) / 1000,
        milestones: 12000,
        invoiceCount: postedInvoices.length,
      },
      outflowDetails: {
        payables: Math.round(totalPayable * 0.55 * 1000) / 1000,
        operationalExpenses: Math.round(monthlyRunRateExpense * 1000) / 1000,
        billCount: postedPurchases.length,
      },
    },
    {
      periodKey: '60',
      periodLabel: 'Next 60 Days',
      daysRange: 'Days 31 – 60',
      incoming: incoming60,
      outgoing: outgoing60,
      net: net60,
      cumulativeBalance: bal60,
      inflowDetails: {
        receivables: Math.round(totalReceivable * 0.35 * 1000) / 1000,
        milestones: 18000,
        invoiceCount: Math.ceil(postedInvoices.length * 0.7),
      },
      outflowDetails: {
        payables: Math.round(totalPayable * 0.30 * 1000) / 1000,
        operationalExpenses: Math.round(monthlyRunRateExpense * 1000) / 1000,
        billCount: Math.ceil(postedPurchases.length * 0.6),
      },
    },
    {
      periodKey: '90',
      periodLabel: 'Next 90 Days',
      daysRange: 'Days 61 – 90',
      incoming: incoming90,
      outgoing: outgoing90,
      net: net90,
      cumulativeBalance: bal90,
      inflowDetails: {
        receivables: Math.round(totalReceivable * 0.15 * 1000) / 1000,
        milestones: 24000,
        invoiceCount: Math.ceil(postedInvoices.length * 0.4),
      },
      outflowDetails: {
        payables: Math.round(totalPayable * 0.15 * 1000) / 1000,
        operationalExpenses: Math.round(monthlyRunRateExpense * 1000) / 1000,
        billCount: Math.ceil(postedPurchases.length * 0.3),
      },
    },
  ];

  const totalIncoming90d = addMoney(addMoney(incoming30, incoming60), incoming90);
  const totalOutgoing90d = addMoney(addMoney(outgoing30, outgoing60), outgoing90);
  const netCashFlow90d = subtractMoney(totalIncoming90d, totalOutgoing90d);
  const projectedClosingBalance90d = bal90;

  const burnRatePerDay = Math.round((totalOutgoing90d / 90) * 1000) / 1000;
  const runwayDays = burnRatePerDay > 0 ? Math.round(currentLiquidBalance / burnRatePerDay) : 999;

  let status: 'surplus' | 'balanced' | 'deficit' = 'surplus';
  let statusDescription = 'Positive cash flow trajectory with solid liquidity coverage.';

  if (projectedClosingBalance90d < 0) {
    status = 'deficit';
    statusDescription = 'Projected cash shortfall detected within 90 days. Acceleration of client IPC billing required.';
  } else if (netCashFlow90d < 0) {
    status = 'balanced';
    statusDescription = 'Outflows temporarily outpace inflows, but supported by current treasury reserves.';
  }

  return {
    currentLiquidBalance,
    periods,
    totalIncoming90d,
    totalOutgoing90d,
    netCashFlow90d,
    projectedClosingBalance90d,
    burnRatePerDay,
    runwayDays,
    status,
    statusDescription,
  };
}
