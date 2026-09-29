/**
 * Human-readable, business-language activity labels shown to the user while
 * a tool call is in flight (e.g. "Checking project financial data…") —
 * never the internal tool name/id, per the Phase 2 chat-UX requirement that
 * the assistant not expose implementation details like `get_project_summary`.
 */
const LABELS: Record<string, string> = {
  get_projects: 'Looking up projects…',
  get_project_summary: 'Checking project financial data…',
  get_clients: 'Looking up customers…',
  get_client_details: 'Checking customer details…',
  get_client_balance: 'Checking outstanding customer balance…',
  get_vendors: 'Looking up vendors…',
  get_vendor_details: 'Checking vendor details…',
  get_vendor_balance: 'Checking outstanding vendor balance…',
  get_invoices: 'Looking up invoices…',
  get_invoice_details: 'Checking invoice details…',
  get_receivables: 'Checking total receivables…',
  get_payables: 'Checking total payables…',
  get_receipts: 'Checking client receipts…',
  get_vendor_payments: 'Checking vendor payments…',
  get_expenses: 'Checking project expenses…',
  get_bank_accounts: 'Checking bank accounts…',
  get_bank_transactions: 'Checking bank transactions…',
  get_cash_position: 'Checking cash position…',
  search_knowledge: 'Searching CAS knowledge base…',
};

export function toolActivityLabel(toolName: string): string {
  return LABELS[toolName] ?? 'Checking CAS data…';
}
