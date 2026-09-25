import {
  Project,
  Customer,
  Vendor,
  BankAccount,
  CashAccount,
  PettyCashAccount,
  BusinessPartner,
  ExpenseHead,
  ClientInvoice,
  Purchase,
  CreditDebitNote,
  NoteType,
  NoteParty,
  NoteSourceType,
  MoneyIn,
  MoneyOut,
  DirectExpense,
  AccountTransfer,
  OpeningBalanceEntry,
  ProjectLedgerEntry,
  CustomerLedgerEntry,
  VendorLedgerEntry,
  TreasuryLedgerEntry,
  JournalEntry,
  AuditLogEntry,
  ProjectProfitability,
  TreasuryAccountType,
  TransactionStatus,
  Transaction,
  VatTreatment,
} from '../types';
import { addMoney, subtractMoney } from '../utils/formatters';
import { computeVatSplit } from '../utils/vat';
import { getSupabaseClient } from './supabaseClient';
import { authService } from './authService';

let globalMonotonicCounter = 0;

/**
 * Robust unique document reference generator (used for entry numbers /
 * default document refs before a row exists in the database).
 */
export function generateUniqueRef(prefix: string): string {
  globalMonotonicCounter += 1;
  const time = Date.now();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${time}-${globalMonotonicCounter}-${rand}`;
}

export interface AppDatabaseState {
  projects: Project[];
  customers: Customer[];
  vendors: Vendor[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  pettyCashAccounts: PettyCashAccount[];
  businessPartners: BusinessPartner[];
  expenseHeads: ExpenseHead[];
  clientInvoices: ClientInvoice[];
  purchases: Purchase[];
  creditDebitNotes: CreditDebitNote[];
  moneyInList: MoneyIn[];
  moneyOutList: MoneyOut[];
  directExpenses: DirectExpense[];
  transfers: AccountTransfer[];
  openingBalances: OpeningBalanceEntry[];
  journalEntries: JournalEntry[];
  auditLogs: AuditLogEntry[];
}

function emptyState(): AppDatabaseState {
  return {
    projects: [],
    customers: [],
    vendors: [],
    bankAccounts: [],
    cashAccounts: [],
    pettyCashAccounts: [],
    businessPartners: [],
    expenseHeads: [],
    clientInvoices: [],
    purchases: [],
    creditDebitNotes: [],
    moneyInList: [],
    moneyOutList: [],
    directExpenses: [],
    transfers: [],
    openingBalances: [],
    journalEntries: [],
    auditLogs: [],
  };
}

// -------------------------------------------------------------
// ROW <-> APP MODEL MAPPERS
// Supabase is the sole source of truth; the in-memory `state` below is a
// read cache populated from these tables and kept fresh via subscribe() +
// Realtime change notifications. Denormalized display names (customerName,
// projectName, accountName, etc.) are resolved from the in-memory master
// data cache, matching prior in-app behavior.
// -------------------------------------------------------------
const workflowFields = (row: any) => ({
  createdBy: row.created_by ?? undefined,
  submittedBy: row.submitted_by ?? undefined,
  submittedAt: row.submitted_at ?? undefined,
  approvedBy: row.approved_by ?? undefined,
  approvedByName: row.approved_by_name ?? undefined,
  approvedAt: row.approved_at ?? undefined,
  postedBy: row.posted_by ?? undefined,
  postedAt: row.posted_at ?? undefined,
  rejectionReason: row.rejection_reason ?? undefined,
});

class AccountingService {
  private state: AppDatabaseState = emptyState();
  private listeners: (() => void)[] = [];
  private loaded = false;
  private loadError: string | null = null;
  private realtimeChannel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
  // Guards the auto-triggered bootstrap load only (below) against being
  // kicked off twice — once as soon as a session is known, and again once
  // authService finishes resolving the full profile/roles chain. Manual/
  // mutation-triggered loadAll() calls elsewhere are unaffected.
  private bootstrapping = false;

  constructor() {
    authService.subscribe(() => {
      // Start fetching as soon as a Supabase session exists rather than
      // waiting for authService's full profile/roles chain to resolve —
      // RLS (is_active_user(), has_permission()) is enforced server-side
      // from auth.uid() regardless, so there's nothing to gain by waiting,
      // and this lets the two round trips run in parallel instead of
      // back-to-back.
      if (authService.hasActiveSession() && !this.loaded && !this.bootstrapping) {
        this.bootstrapping = true;
        this.loadAll().finally(() => {
          this.bootstrapping = false;
        });
      }
      if (!authService.hasActiveSession()) {
        this.teardownRealtime();
        this.state = emptyState();
        this.loaded = false;
        this.notify();
      }
    });
    if (authService.hasActiveSession()) {
      this.bootstrapping = true;
      this.loadAll().finally(() => {
        this.bootstrapping = false;
      });
    }
  }

  // -------------------------------------------------------------
  // LOAD / SYNC
  // -------------------------------------------------------------
  public isLoaded(): boolean {
    return this.loaded;
  }

  public getLoadError(): string | null {
    return this.loadError;
  }

  public async refreshFromStorage(): Promise<void> {
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      this.loadError = 'Supabase is not configured.';
      this.notify();
      return;
    }

    try {
      const [
        projects, customers, vendors, bankAccounts, cashAccounts, pettyCashAccounts,
        businessPartners, expenseHeads, clientInvoices, purchases, creditDebitNotes, moneyIn, moneyOut, directExpenses,
        transfers, openingBalances, journalEntries, auditLogs,
      ] = await Promise.all([
        client.from('projects').select('*').order('created_at', { ascending: true }),
        client.from('customers').select('*').order('created_at', { ascending: true }),
        client.from('vendors').select('*').order('created_at', { ascending: true }),
        client.from('bank_accounts').select('*').order('created_at', { ascending: true }),
        client.from('cash_accounts').select('*').order('created_at', { ascending: true }),
        client.from('petty_cash_accounts').select('*').order('created_at', { ascending: true }),
        client.from('business_partners').select('*').order('created_at', { ascending: true }),
        client.from('expense_heads').select('*').order('created_at', { ascending: true }),
        client.from('client_invoices').select('*').order('created_at', { ascending: true }),
        client.from('purchases').select('*').order('created_at', { ascending: true }),
        client.from('credit_debit_notes').select('*').order('created_at', { ascending: true }),
        client.from('money_in').select('*').order('created_at', { ascending: true }),
        client.from('money_out').select('*').order('created_at', { ascending: true }),
        client.from('direct_expenses').select('*').order('created_at', { ascending: true }),
        client.from('transfers').select('*').order('created_at', { ascending: true }),
        client.from('opening_balances').select('*').order('created_at', { ascending: true }),
        client.from('journal_entries').select('*').order('created_at', { ascending: true }),
        client.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(2000),
      ]);

      const firstError = [
        projects, customers, vendors, bankAccounts, cashAccounts, pettyCashAccounts, businessPartners,
        expenseHeads, clientInvoices, purchases, creditDebitNotes, moneyIn, moneyOut, directExpenses, transfers, openingBalances,
        journalEntries, auditLogs,
      ].find((r) => r.error)?.error;
      if (firstError) throw firstError;

      const newState: AppDatabaseState = {
        projects: (projects.data ?? []).map(this.mapProject),
        customers: (customers.data ?? []).map(this.mapCustomer),
        vendors: (vendors.data ?? []).map(this.mapVendor),
        bankAccounts: (bankAccounts.data ?? []).map(this.mapBankAccount),
        cashAccounts: (cashAccounts.data ?? []).map(this.mapCashAccount),
        pettyCashAccounts: (pettyCashAccounts.data ?? []).map(this.mapPettyCashAccount),
        businessPartners: (businessPartners.data ?? []).map(this.mapBusinessPartner),
        expenseHeads: (expenseHeads.data ?? []).map(this.mapExpenseHead),
        clientInvoices: [],
        purchases: [],
        creditDebitNotes: [],
        moneyInList: [],
        moneyOutList: [],
        directExpenses: [],
        transfers: [],
        openingBalances: [],
        journalEntries: (journalEntries.data ?? []).map(this.mapJournalEntry),
        auditLogs: (auditLogs.data ?? []).map(this.mapAuditLog),
      };

      // Second pass: map transactional tables now that master data is available
      // for denormalized display-name resolution.
      this.state = newState;
      this.state.clientInvoices = (clientInvoices.data ?? []).map((r) => this.mapClientInvoice(r));
      this.state.purchases = (purchases.data ?? []).map((r) => this.mapPurchase(r));
      this.state.creditDebitNotes = (creditDebitNotes.data ?? []).map((r) => this.mapCreditDebitNote(r));
      this.state.moneyInList = (moneyIn.data ?? []).map((r) => this.mapMoneyIn(r));
      this.state.moneyOutList = (moneyOut.data ?? []).map((r) => this.mapMoneyOut(r));
      this.state.directExpenses = (directExpenses.data ?? []).map((r) => this.mapDirectExpense(r));
      this.state.transfers = (transfers.data ?? []).map((r) => this.mapTransfer(r));
      this.state.openingBalances = (openingBalances.data ?? []).map((r) => this.mapOpeningBalance(r));

      this.loaded = true;
      this.loadError = null;
      this.setupRealtime();
      this.notify();
    } catch (err: any) {
      this.loadError = err?.message || 'Failed to load accounting data from Supabase.';
      console.error('[AccountingService] loadAll failed:', err);
      this.notify();
    }
  }

  private setupRealtime() {
    const client = getSupabaseClient();
    if (!client || this.realtimeChannel) return;
    const tables = [
      'projects', 'customers', 'vendors', 'bank_accounts', 'cash_accounts', 'petty_cash_accounts',
      'business_partners', 'expense_heads', 'client_invoices', 'purchases', 'credit_debit_notes', 'money_in', 'money_out', 'direct_expenses',
      'transfers', 'opening_balances', 'journal_entries',
    ];
    let channel = client.channel('accounting-data-sync');
    tables.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        // Coarse-grained refresh on any remote change (from this device, the
        // web app, or the Android app) keeps every client's cache authoritative.
        this.loadAll();
      });
    });
    channel.subscribe();
    this.realtimeChannel = channel;
  }

  private teardownRealtime() {
    const client = getSupabaseClient();
    if (client && this.realtimeChannel) {
      client.removeChannel(this.realtimeChannel);
    }
    this.realtimeChannel = null;
  }

  // -------------------------------------------------------------
  // MAPPERS
  // -------------------------------------------------------------
  private mapProject = (row: any): Project => ({
    id: row.id,
    code: row.code,
    name: row.name,
    customerId: row.customer_id,
    customerName: this.state.customers?.find((c) => c.id === row.customer_id)?.name,
    contractValue: Number(row.contract_value) || 0,
    budgetCost: row.budget_cost != null ? Number(row.budget_cost) : undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapCustomer = (row: any): Customer => ({
    id: row.id,
    code: row.code,
    name: row.name,
    vatin: row.vatin ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    openingBalance: Number(row.opening_balance) || 0,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapVendor = (row: any): Vendor => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category ?? undefined,
    vatin: row.vatin ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    openingBalance: Number(row.opening_balance) || 0,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapBankAccount = (row: any): BankAccount => ({
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number ?? '',
    iban: row.iban ?? undefined,
    branch: row.branch ?? undefined,
    currency: 'OMR',
    openingBalance: Number(row.opening_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    openingDate: row.opening_date ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapCashAccount = (row: any): CashAccount => ({
    id: row.id,
    accountName: row.account_name,
    openingBalance: Number(row.opening_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    openingDate: row.opening_date ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapPettyCashAccount = (row: any): PettyCashAccount => ({
    id: row.id,
    accountName: row.account_name,
    openingBalance: Number(row.opening_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    openingDate: row.opening_date ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapBusinessPartner = (row: any): BusinessPartner => ({
    id: row.id,
    code: row.code,
    name: row.name,
    partnerType: row.partner_type,
    contactPerson: row.contact_person ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    openingBalance: Number(row.opening_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapExpenseHead = (row: any): ExpenseHead => ({
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    description: row.remarks ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
  });

  private resolveAccountName(type: TreasuryAccountType, id?: string): string | undefined {
    if (!id) return undefined;
    return this.getAccountName(type, id);
  }

  private mapClientInvoice = (row: any): ClientInvoice => {
    const customer = this.state.customers.find((c) => c.id === row.customer_id);
    const project = this.state.projects.find((p) => p.id === row.project_id);
    return {
      id: row.id,
      invoiceType: row.invoice_type,
      invoiceNumber: row.invoice_number,
      date: row.date,
      customerId: row.customer_id,
      customerName: customer?.name || 'Unknown Customer',
      projectId: row.project_id,
      projectName: project?.name || 'Unknown Project',
      description: row.description ?? '',
      amount: Number(row.amount) || 0,
      netAmount: Number(row.net_amount) || 0,
      vatRate: Number(row.vat_rate) || 0,
      vatAmount: Number(row.vat_amount) || 0,
      vatTreatment: row.vat_treatment || 'out_of_scope',
      documentRef: row.document_ref,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      receivedAmount: Number(row.received_amount) || 0,
      outstandingAmount: Number(row.outstanding_amount) || 0,
      status: row.status,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      ...workflowFields(row),
    };
  };

  private mapPurchase = (row: any): Purchase => {
    const vendor = this.state.vendors.find((v) => v.id === row.vendor_id);
    const project = this.state.projects.find((p) => p.id === row.project_id);
    return {
      id: row.id,
      purchaseInvoiceNumber: row.purchase_invoice_number,
      date: row.date,
      vendorId: row.vendor_id,
      vendorName: vendor?.name || 'Unknown Vendor',
      projectId: row.project_id,
      projectName: project?.name || 'Unknown Project',
      purchaseCategory: row.purchase_category ?? 'Materials',
      description: row.description ?? '',
      amount: Number(row.amount) || 0,
      netAmount: Number(row.net_amount) || 0,
      vatRate: Number(row.vat_rate) || 0,
      vatAmount: Number(row.vat_amount) || 0,
      vatTreatment: row.vat_treatment || 'out_of_scope',
      documentRef: row.document_ref,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      paidAmount: Number(row.paid_amount) || 0,
      outstandingAmount: Number(row.outstanding_amount) || 0,
      status: row.status,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      ...workflowFields(row),
    };
  };

  private mapCreditDebitNote = (row: any): CreditDebitNote => {
    const customer = row.customer_id ? this.state.customers.find((c) => c.id === row.customer_id) : undefined;
    const vendor = row.vendor_id ? this.state.vendors.find((v) => v.id === row.vendor_id) : undefined;
    const project = this.state.projects.find((p) => p.id === row.project_id);
    return {
      id: row.id,
      noteType: row.note_type,
      noteNumber: row.note_number,
      date: row.date,
      partyType: row.party_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceDocumentNumber: row.source_document_number,
      customerId: row.customer_id ?? undefined,
      customerName: customer?.name,
      vendorId: row.vendor_id ?? undefined,
      vendorName: vendor?.name,
      projectId: row.project_id,
      projectName: project?.name || 'Unknown Project',
      reason: row.reason ?? '',
      netAmount: Number(row.net_amount) || 0,
      vatRate: Number(row.vat_rate) || 0,
      vatAmount: Number(row.vat_amount) || 0,
      grossAmount: Number(row.gross_amount) || 0,
      vatTreatment: row.vat_treatment || 'out_of_scope',
      documentRef: row.document_ref,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      status: row.status,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
    };
  };

  private mapMoneyIn = (row: any): MoneyIn => {
    const customer = row.customer_id ? this.state.customers.find((c) => c.id === row.customer_id) : undefined;
    const project = this.state.projects.find((p) => p.id === row.project_id);
    const invoice = row.invoice_id ? this.state.clientInvoices.find((i) => i.id === row.invoice_id) : undefined;
    return {
      id: row.id,
      transactionDate: row.transaction_date,
      receivedFrom: row.received_from,
      customerId: row.customer_id ?? undefined,
      customerName: customer?.name,
      projectId: row.project_id,
      projectName: project?.name || 'Unknown Project',
      against: row.against,
      invoiceId: row.invoice_id ?? undefined,
      invoiceNumber: invoice?.invoiceNumber,
      amount: Number(row.amount) || 0,
      receivedInto: row.received_into,
      accountId: row.account_id,
      accountName: this.resolveAccountName(row.received_into, row.account_id) || 'Account',
      documentRef: row.document_ref,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      status: row.status,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      ...workflowFields(row),
    };
  };

  private mapMoneyOut = (row: any): MoneyOut => {
    const vendor = row.vendor_id ? this.state.vendors.find((v) => v.id === row.vendor_id) : undefined;
    const project = row.project_id ? this.state.projects.find((p) => p.id === row.project_id) : undefined;
    const purchase = row.purchase_id ? this.state.purchases.find((p) => p.id === row.purchase_id) : undefined;
    const expenseHead = row.expense_head_id ? this.state.expenseHeads.find((e) => e.id === row.expense_head_id) : undefined;
    return {
      id: row.id,
      transactionDate: row.transaction_date,
      paidTo: row.paid_to,
      vendorId: row.vendor_id ?? undefined,
      vendorName: vendor?.name,
      projectId: row.project_id ?? undefined,
      projectName: project?.name,
      paymentFor: row.payment_for,
      purchaseId: row.purchase_id ?? undefined,
      purchaseInvoiceNumber: purchase?.purchaseInvoiceNumber,
      expenseHeadId: row.expense_head_id ?? undefined,
      expenseHeadName: expenseHead?.name,
      amount: Number(row.amount) || 0,
      paidFrom: row.paid_from,
      accountId: row.account_id,
      accountName: this.resolveAccountName(row.paid_from, row.account_id) || 'Account',
      documentRef: row.document_ref,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      status: row.status,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      ...workflowFields(row),
    };
  };

  private mapDirectExpense = (row: any): DirectExpense => {
    const project = this.state.projects.find((p) => p.id === row.project_id);
    const expenseHead = this.state.expenseHeads.find((e) => e.id === row.expense_head_id);
    return {
      id: row.id,
      expenseDate: row.expense_date,
      projectId: row.project_id,
      projectName: project?.name || 'Unknown Project',
      projectCode: project?.code,
      expenseHeadId: row.expense_head_id,
      expenseHeadName: expenseHead?.name || 'General Expense',
      description: row.description ?? '',
      amount: Number(row.amount) || 0,
      netAmount: Number(row.net_amount) || 0,
      vatRate: Number(row.vat_rate) || 0,
      vatAmount: Number(row.vat_amount) || 0,
      vatTreatment: row.vat_treatment || 'out_of_scope',
      paidFrom: row.paid_from,
      accountId: row.account_id,
      accountName: this.resolveAccountName(row.paid_from, row.account_id) || 'Account',
      vendorName: row.vendor_name ?? undefined,
      documentRef: row.document_ref,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentName: row.attachment_name ?? undefined,
      status: row.status,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      ...workflowFields(row),
    };
  };

  private mapTransfer = (row: any): AccountTransfer => ({
    id: row.id,
    date: row.date,
    transferFromType: row.transfer_from_type,
    transferFromId: row.transfer_from_id,
    transferFromName: this.resolveAccountName(row.transfer_from_type, row.transfer_from_id) || 'Account',
    transferToType: row.transfer_to_type,
    transferToId: row.transfer_to_id,
    transferToName: this.resolveAccountName(row.transfer_to_type, row.transfer_to_id) || 'Account',
    amount: Number(row.amount) || 0,
    documentRef: row.document_ref,
    attachmentUrl: row.attachment_url ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
  });

  private mapOpeningBalance = (row: any): OpeningBalanceEntry => ({
    id: row.id,
    accountType: row.account_type,
    accountId: row.account_id,
    accountName:
      row.account_type === 'customer'
        ? this.state.customers.find((c) => c.id === row.account_id)?.name || 'Account'
        : row.account_type === 'vendor'
        ? this.state.vendors.find((v) => v.id === row.account_id)?.name || 'Account'
        : this.resolveAccountName(row.account_type, row.account_id) || 'Account',
    openingDate: row.opening_date,
    amount: Number(row.amount) || 0,
    documentRef: row.document_ref ?? undefined,
    attachmentUrl: row.attachment_url ?? undefined,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  });

  private mapJournalEntry = (row: any): JournalEntry => ({
    id: row.id,
    entryNumber: row.entry_number,
    date: row.date,
    sourceType: row.source_type,
    sourceId: row.source_id,
    projectId: row.project_id ?? undefined,
    customerId: row.customer_id ?? undefined,
    vendorId: row.vendor_id ?? undefined,
    description: row.description,
    debitAccount: row.debit_account,
    creditAccount: row.credit_account,
    amount: Number(row.amount) || 0,
    status: row.status,
    createdAt: row.created_at,
  });

  private mapAuditLog = (row: any): AuditLogEntry => ({
    id: row.id,
    timestamp: row.timestamp,
    userId: row.user_id ?? '',
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    module: row.module,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    transactionId: row.transaction_id ?? undefined,
    documentRef: row.document_ref ?? undefined,
    reason: row.reason ?? undefined,
    oldValue: row.old_value ?? undefined,
    newValue: row.new_value ?? undefined,
    oldValues: row.old_values ?? undefined,
    newValues: row.new_values ?? undefined,
    details: row.details,
    ipAddress: row.ip_address ?? undefined,
  });

  // -------------------------------------------------------------
  // SUBSCRIBE / STATE ACCESS
  // -------------------------------------------------------------
  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getState(): AppDatabaseState {
    return this.state;
  }

  public verifyProjectAccess(projectId: string): void {
    if (!projectId) return;
    if (!authService.hasProjectAccess(projectId)) {
      throw new Error(`Unauthorized: Your account does not have access to project "${projectId}". Access restricted by Project Scope policy.`);
    }
  }

  public getAccountName(type: TreasuryAccountType, id: string): string {
    if (type === 'bank') {
      return this.state.bankAccounts.find((b) => b.id === id)?.accountName || 'Bank Account';
    }
    if (type === 'cash') {
      return this.state.cashAccounts.find((c) => c.id === id)?.accountName || 'Cash in Hand';
    }
    if (type === 'petty_cash') {
      return this.state.pettyCashAccounts.find((p) => p.id === id)?.accountName || 'Petty Cash';
    }
    if (type === 'partner') {
      return this.state.businessPartners.find((p) => p.id === id)?.name || 'Business Partner';
    }
    return 'Unknown Account';
  }

  private requireClient() {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase is not configured. Data cannot be saved.');
    return client;
  }

  private currentUserName(): string {
    return authService.getCurrentUser()?.fullName || 'Unknown User';
  }

  // -------------------------------------------------------------
  // 1. CLIENT INVOICE / IPC
  // -------------------------------------------------------------
  public async createClientInvoice(data: {
    invoiceType: 'IPC' | 'Invoice';
    date: string;
    customerId: string;
    projectId: string;
    description: string;
    netAmount: number;
    vatRate: number;
    vatTreatment: VatTreatment;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<ClientInvoice> {
    if (!data.customerId) throw new Error('Customer is required.');
    if (!data.projectId) throw new Error('Project is required.');
    if (data.netAmount <= 0) throw new Error('Amount must be positive.');
    if (!data.documentRef?.trim()) throw new Error('Document Reference is required.');

    const client = this.requireClient();
    const customer = this.state.customers.find((c) => c.id === data.customerId);
    const project = this.state.projects.find((p) => p.id === data.projectId);
    const customerName = customer ? customer.name : 'Unknown Customer';
    const projectName = project ? project.name : 'Unknown Project';
    const vat = computeVatSplit(data.netAmount, data.vatRate, data.vatTreatment);

    // invoiceNumber is intentionally not sent — create_client_invoice generates
    // it server-side via next_document_number(), so numbering stays sequential
    // and gap-free (Oman VAT requires this), regardless of what a client sends.
    const { data: row, error } = await client.rpc('create_client_invoice', {
      payload: {
        invoiceType: data.invoiceType,
        date: data.date,
        customerId: data.customerId,
        projectId: data.projectId,
        description: data.description,
        amount: vat.grossAmount,
        netAmount: vat.netAmount,
        vatRate: vat.vatRate,
        vatAmount: vat.vatAmount,
        vatTreatment: vat.vatTreatment,
        documentRef: data.documentRef.trim(),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-INV'),
        journalDescription: `${data.invoiceType} - ${customerName}`,
        debitAccount: `Accounts Receivable (${customerName})`,
        creditAccount: `Project Revenue (${projectName})`,
        auditDetails: `Posted ${data.invoiceType} — Net OMR ${vat.netAmount.toFixed(3)} + VAT OMR ${vat.vatAmount.toFixed(3)} = Gross OMR ${vat.grossAmount.toFixed(3)} to Project "${projectName}".`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.clientInvoices.find((i) => i.id === row.id) || this.mapClientInvoice(row);
  }

  /**
   * Imports a Client Invoice/IPC, preserving its real original invoice
   * number instead of assigning a new one via next_document_number()
   * (which create_client_invoice always does, and which sequences by the
   * CURRENT calendar year — wrong for backfilling a real past document).
   * Requires the invoices.import permission; the invoiceNumber must not
   * already exist (enforced by both the RPC and the table's UNIQUE
   * constraint on invoice_number).
   */
  public async importClientInvoice(data: {
    invoiceType: 'IPC' | 'Invoice';
    invoiceNumber: string;
    date: string;
    customerId: string;
    projectId: string;
    description?: string;
    netAmount: number;
    vatRate: number;
    vatTreatment: VatTreatment;
    documentRef: string;
    remarks?: string;
  }): Promise<ClientInvoice> {
    if (!data.invoiceNumber?.trim()) throw new Error('Invoice number is required.');
    if (!data.customerId) throw new Error('Customer is required.');
    if (!data.projectId) throw new Error('Project is required.');
    if (data.netAmount <= 0) throw new Error('Amount must be positive.');
    if (!data.documentRef?.trim()) throw new Error('Document Reference is required.');

    const client = this.requireClient();
    const customer = this.state.customers.find((c) => c.id === data.customerId);
    const project = this.state.projects.find((p) => p.id === data.projectId);
    const customerName = customer ? customer.name : 'Unknown Customer';
    const projectName = project ? project.name : 'Unknown Project';
    const vat = computeVatSplit(data.netAmount, data.vatRate, data.vatTreatment);

    const { data: row, error } = await client.rpc('import_client_invoice', {
      payload: {
        invoiceType: data.invoiceType,
        invoiceNumber: data.invoiceNumber.trim(),
        date: data.date,
        customerId: data.customerId,
        projectId: data.projectId,
        description: data.description,
        amount: vat.grossAmount,
        netAmount: vat.netAmount,
        vatRate: vat.vatRate,
        vatAmount: vat.vatAmount,
        vatTreatment: vat.vatTreatment,
        documentRef: data.documentRef.trim(),
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-INV'),
        journalDescription: `${data.invoiceType} - ${customerName} (bulk import)`,
        debitAccount: `Accounts Receivable (${customerName})`,
        creditAccount: `Project Revenue (${projectName})`,
        auditDetails: `Imported ${data.invoiceType} "${data.invoiceNumber}" — Net OMR ${vat.netAmount.toFixed(3)} + VAT OMR ${vat.vatAmount.toFixed(3)} = Gross OMR ${vat.grossAmount.toFixed(3)} to Project "${projectName}".`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.clientInvoices.find((i) => i.id === row.id) || this.mapClientInvoice(row);
  }

  // -------------------------------------------------------------
  // 2. MONEY IN (Client Receipts & Incoming Treasury)
  // -------------------------------------------------------------
  public async recordMoneyIn(data: {
    transactionDate: string;
    receivedFrom: string;
    customerId?: string;
    projectId: string;
    against: 'invoice' | 'other';
    invoiceId?: string;
    amount: number;
    receivedInto: TreasuryAccountType;
    accountId: string;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<MoneyIn> {
    if (!data.receivedFrom?.trim()) throw new Error('Received From is required.');
    if (!data.projectId) throw new Error('Project is required.');
    if (data.amount <= 0) throw new Error('Amount must be positive.');
    if (!data.accountId) throw new Error('Please select receiving Bank/Cash account.');
    if (data.against === 'invoice' && !data.invoiceId) {
      throw new Error('Client Invoice / IPC must be selected when against invoice.');
    }

    const client = this.requireClient();
    const invoice = data.invoiceId ? this.state.clientInvoices.find((i) => i.id === data.invoiceId) : undefined;
    const customer = data.customerId
      ? this.state.customers.find((c) => c.id === data.customerId)
      : invoice
      ? this.state.customers.find((c) => c.id === invoice.customerId)
      : undefined;
    const accountName = this.getAccountName(data.receivedInto, data.accountId);

    const { data: row, error } = await client.rpc('record_money_in', {
      payload: {
        transactionDate: data.transactionDate,
        receivedFrom: data.receivedFrom.trim(),
        customerId: customer?.id,
        projectId: data.projectId,
        against: data.against,
        invoiceId: data.invoiceId,
        amount: data.amount,
        receivedInto: data.receivedInto,
        accountId: data.accountId,
        documentRef: data.documentRef?.trim() || generateUniqueRef('RECEIPT'),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-RCPT'),
        journalDescription: `Client Receipt from ${data.receivedFrom} via ${accountName}`,
        debitAccount: `${accountName} (${data.receivedInto.toUpperCase()})`,
        creditAccount: customer ? `Accounts Receivable (${customer.name})` : 'Other Receipts',
        auditDetails: `Received OMR ${data.amount} from "${data.receivedFrom}" into "${accountName}".`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.moneyInList.find((m) => m.id === row.id) || this.mapMoneyIn(row);
  }

  /**
   * Fills in currently-blank fields (customerId, remarks) on an already
   * posted Money In record — used by the bulk transaction import to
   * enrich an existing row without creating a duplicate. Never overwrites a
   * field that already has a value; the `fill_missing_money_in_fields` RPC
   * enforces that server-side and requires the money_in.import permission.
   */
  public async fillMissingMoneyInFields(
    id: string,
    patch: { customerId?: string; remarks?: string }
  ): Promise<MoneyIn> {
    const client = this.requireClient();
    const { data: row, error } = await client.rpc('fill_missing_money_in_fields', {
      p_id: id,
      patch: {
        customerId: patch.customerId,
        remarks: patch.remarks,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.moneyInList.find((m) => m.id === row.id) || this.mapMoneyIn(row);
  }

  // -------------------------------------------------------------
  // 3. PURCHASES (Vendor Bill)
  // -------------------------------------------------------------
  public async createPurchase(data: {
    purchaseInvoiceNumber: string;
    date: string;
    vendorId: string;
    projectId: string;
    purchaseCategory?: string;
    description: string;
    netAmount: number;
    vatRate: number;
    vatTreatment: VatTreatment;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<Purchase> {
    if (!data.purchaseInvoiceNumber?.trim()) throw new Error('Purchase Invoice Number is required.');
    if (!data.vendorId) throw new Error('Vendor is required.');
    if (!data.projectId) throw new Error('Project is required.');
    if (data.netAmount <= 0) throw new Error('Amount must be positive.');
    if (!data.documentRef?.trim()) throw new Error('Document Reference is required.');

    const client = this.requireClient();
    const vendor = this.state.vendors.find((v) => v.id === data.vendorId);
    const project = this.state.projects.find((p) => p.id === data.projectId);
    const vendorName = vendor ? vendor.name : 'Unknown Vendor';
    const projectName = project ? project.name : 'Unknown Project';
    const vat = computeVatSplit(data.netAmount, data.vatRate, data.vatTreatment);

    const { data: row, error } = await client.rpc('create_purchase', {
      payload: {
        purchaseInvoiceNumber: data.purchaseInvoiceNumber.trim(),
        date: data.date,
        vendorId: data.vendorId,
        projectId: data.projectId,
        purchaseCategory: data.purchaseCategory || 'Materials',
        description: data.description,
        amount: vat.grossAmount,
        netAmount: vat.netAmount,
        vatRate: vat.vatRate,
        vatAmount: vat.vatAmount,
        vatTreatment: vat.vatTreatment,
        documentRef: data.documentRef.trim(),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-PUR'),
        journalDescription: `Purchase Invoice #${data.purchaseInvoiceNumber.trim()} - ${vendorName}`,
        debitAccount: `Project Cost - Materials (${projectName})`,
        creditAccount: `Accounts Payable (${vendorName})`,
        auditDetails: `Posted Purchase #${data.purchaseInvoiceNumber} from "${vendorName}" — Net OMR ${vat.netAmount.toFixed(3)} + VAT OMR ${vat.vatAmount.toFixed(3)} = Gross OMR ${vat.grossAmount.toFixed(3)}.`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.purchases.find((p) => p.id === row.id) || this.mapPurchase(row);
  }

  // -------------------------------------------------------------
  // 3b. CREDIT / DEBIT NOTES
  // Amends a posted ClientInvoice (customer-side, Output VAT) or Purchase
  // (vendor-side, Input VAT): the source document's amount/netAmount/
  // vatAmount/outstanding are adjusted by the note's effect server-side,
  // never rewritten directly by the client.
  // -------------------------------------------------------------
  public async createCreditDebitNote(data: {
    noteType: NoteType;
    partyType: NoteParty;
    sourceType: NoteSourceType;
    sourceId: string;
    date: string;
    reason: string;
    netAmount: number;
    vatRate: number;
    vatTreatment: VatTreatment;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<CreditDebitNote> {
    if (!data.sourceId) throw new Error('Source document is required.');
    if (!data.reason?.trim()) throw new Error('Reason for the note is required.');
    if (data.netAmount <= 0) throw new Error('Amount must be positive.');
    if (!data.documentRef?.trim()) throw new Error('Document Reference is required.');

    const client = this.requireClient();
    const vat = computeVatSplit(data.netAmount, data.vatRate, data.vatTreatment);

    const sourceLabel =
      data.partyType === 'customer'
        ? this.state.clientInvoices.find((i) => i.id === data.sourceId)?.invoiceNumber
        : this.state.purchases.find((p) => p.id === data.sourceId)?.purchaseInvoiceNumber;

    const { data: row, error } = await client.rpc('create_credit_debit_note', {
      payload: {
        noteType: data.noteType,
        partyType: data.partyType,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        date: data.date,
        reason: data.reason.trim(),
        netAmount: vat.netAmount,
        vatRate: vat.vatRate,
        vatAmount: vat.vatAmount,
        grossAmount: vat.grossAmount,
        vatTreatment: vat.vatTreatment,
        documentRef: data.documentRef.trim(),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        journalDescription: `${data.noteType === 'credit' ? 'Credit' : 'Debit'} Note against ${sourceLabel || 'source document'}`,
        auditDetails: `Posted ${data.noteType} note against ${sourceLabel || 'source document'} — Net OMR ${vat.netAmount.toFixed(3)} + VAT OMR ${vat.vatAmount.toFixed(3)} = OMR ${vat.grossAmount.toFixed(3)}. Reason: ${data.reason.trim()}`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.creditDebitNotes.find((n) => n.id === row.id) || this.mapCreditDebitNote(row);
  }

  // -------------------------------------------------------------
  // 4. MONEY OUT (Vendor Payments, Expenses & Treasury Disbursals)
  // -------------------------------------------------------------
  public async recordMoneyOut(data: {
    transactionDate: string;
    paidTo: string;
    vendorId?: string;
    projectId?: string;
    paymentFor: 'purchase' | 'expense' | 'other';
    purchaseId?: string;
    expenseHeadId?: string;
    amount: number;
    paidFrom: TreasuryAccountType;
    accountId: string;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<MoneyOut> {
    if (!data.paidTo?.trim()) throw new Error('Paid To is required.');
    if (data.amount <= 0) throw new Error('Amount must be positive.');
    if (!data.accountId) throw new Error('Please select paying Bank/Cash account.');
    if (data.paymentFor === 'purchase' && !data.purchaseId) {
      throw new Error('Purchase Invoice must be selected for purchase payment.');
    }

    const client = this.requireClient();
    const purchase = data.purchaseId ? this.state.purchases.find((p) => p.id === data.purchaseId) : undefined;
    const vendor = data.vendorId
      ? this.state.vendors.find((v) => v.id === data.vendorId)
      : purchase
      ? this.state.vendors.find((v) => v.id === purchase.vendorId)
      : undefined;
    const project = data.projectId
      ? this.state.projects.find((p) => p.id === data.projectId)
      : purchase
      ? this.state.projects.find((p) => p.id === purchase.projectId)
      : undefined;
    const expenseHead = data.expenseHeadId ? this.state.expenseHeads.find((e) => e.id === data.expenseHeadId) : undefined;
    const accountName = this.getAccountName(data.paidFrom, data.accountId);

    const { data: row, error } = await client.rpc('record_money_out', {
      payload: {
        transactionDate: data.transactionDate,
        paidTo: data.paidTo.trim(),
        vendorId: vendor?.id,
        projectId: project?.id,
        paymentFor: data.paymentFor,
        purchaseId: data.purchaseId,
        expenseHeadId: data.expenseHeadId,
        amount: data.amount,
        paidFrom: data.paidFrom,
        accountId: data.accountId,
        documentRef: data.documentRef?.trim() || generateUniqueRef('PAYMENT'),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-PYMT'),
        journalDescription: `Payment to ${data.paidTo} from ${accountName}`,
        debitAccount:
          data.paymentFor === 'purchase' && vendor
            ? `Accounts Payable (${vendor.name})`
            : data.paymentFor === 'expense' && expenseHead
            ? `Expense (${expenseHead.name})`
            : `General Expenses (${data.paidTo})`,
        creditAccount: `${accountName} (${data.paidFrom.toUpperCase()})`,
        auditDetails: `Paid OMR ${data.amount} to "${data.paidTo}" from "${accountName}".`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.moneyOutList.find((m) => m.id === row.id) || this.mapMoneyOut(row);
  }

  /**
   * Fills in currently-blank fields (vendorId, remarks) on an already
   * posted Money Out record — used by the bulk transaction import to
   * enrich an existing row without creating a duplicate. Never overwrites a
   * field that already has a value; the `fill_missing_money_out_fields` RPC
   * enforces that server-side and requires the money_out.import permission.
   */
  public async fillMissingMoneyOutFields(
    id: string,
    patch: { vendorId?: string; remarks?: string }
  ): Promise<MoneyOut> {
    const client = this.requireClient();
    const { data: row, error } = await client.rpc('fill_missing_money_out_fields', {
      p_id: id,
      patch: {
        vendorId: patch.vendorId,
        remarks: patch.remarks,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.moneyOutList.find((m) => m.id === row.id) || this.mapMoneyOut(row);
  }

  // -------------------------------------------------------------
  // 5. DIRECT EXPENSES
  // -------------------------------------------------------------
  public async createDirectExpense(data: {
    expenseDate: string;
    projectId: string;
    expenseHeadId: string;
    description: string;
    netAmount: number;
    vatRate: number;
    vatTreatment: VatTreatment;
    paidFrom: TreasuryAccountType;
    accountId: string;
    vendorName?: string;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<DirectExpense> {
    if (!data.projectId) throw new Error('Project is required.');
    if (!data.expenseHeadId) throw new Error('Expense Head is required.');
    if (!data.description?.trim()) throw new Error('Description is required.');
    if (data.netAmount <= 0) throw new Error('Amount must be positive.');
    if (!data.accountId) throw new Error('Paid From account is required.');

    const client = this.requireClient();
    const project = this.state.projects.find((p) => p.id === data.projectId);
    const expenseHead = this.state.expenseHeads.find((e) => e.id === data.expenseHeadId);
    const accountName = this.getAccountName(data.paidFrom, data.accountId);
    const expenseHeadName = expenseHead ? expenseHead.name : 'General Expense';
    const projectName = project ? project.name : 'Unknown Project';
    const vat = computeVatSplit(data.netAmount, data.vatRate, data.vatTreatment);

    const { data: row, error } = await client.rpc('create_direct_expense', {
      payload: {
        expenseDate: data.expenseDate,
        projectId: data.projectId,
        expenseHeadId: data.expenseHeadId,
        description: data.description.trim(),
        amount: vat.grossAmount,
        netAmount: vat.netAmount,
        vatRate: vat.vatRate,
        vatAmount: vat.vatAmount,
        vatTreatment: vat.vatTreatment,
        paidFrom: data.paidFrom,
        accountId: data.accountId,
        vendorName: data.vendorName,
        documentRef: data.documentRef?.trim() || generateUniqueRef('EXP'),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-EXP'),
        journalDescription: `Direct Expense: ${expenseHeadName} (${data.description}) on ${projectName}`,
        debitAccount: `Project Cost - ${expenseHeadName} (${projectName})`,
        creditAccount: `${accountName} (${data.paidFrom.toUpperCase()})`,
        auditDetails: `Recorded expense — Net OMR ${vat.netAmount.toFixed(3)} + VAT OMR ${vat.vatAmount.toFixed(3)} = Gross OMR ${vat.grossAmount.toFixed(3)} for "${expenseHeadName}" from "${accountName}" on project "${projectName}".`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.directExpenses.find((e) => e.id === row.id) || this.mapDirectExpense(row);
  }

  /**
   * Fills in currently-blank fields (vendorName, remarks) on an already
   * posted Direct Expense record — used by the bulk transaction
   * import to enrich an existing row without creating a duplicate. Never
   * overwrites a field that already has a value; the
   * `fill_missing_direct_expense_fields` RPC enforces that server-side and
   * requires the expenses.import permission.
   */
  public async fillMissingDirectExpenseFields(
    id: string,
    patch: { vendorName?: string; remarks?: string }
  ): Promise<DirectExpense> {
    const client = this.requireClient();
    const { data: row, error } = await client.rpc('fill_missing_direct_expense_fields', {
      p_id: id,
      patch: {
        vendorName: patch.vendorName,
        remarks: patch.remarks,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.directExpenses.find((e) => e.id === row.id) || this.mapDirectExpense(row);
  }

  public async recordDirectExpense(data: {
    expenseDate: string;
    projectId: string;
    expenseHeadId: string;
    description: string;
    netAmount: number;
    vatRate: number;
    vatTreatment: VatTreatment;
    paidFrom: TreasuryAccountType;
    accountId: string;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<DirectExpense> {
    return this.createDirectExpense(data);
  }

  // -------------------------------------------------------------
  // 6. TRANSFERS (Between Company Accounts)
  // -------------------------------------------------------------
  public async createTransfer(data: {
    date: string;
    transferFromType: TreasuryAccountType;
    transferFromId: string;
    transferToType: TreasuryAccountType;
    transferToId: string;
    amount: number;
    documentRef: string;
    attachmentUrl?: string;
    attachmentName?: string;
    remarks?: string;
  }): Promise<AccountTransfer> {
    if (data.amount <= 0) throw new Error('Transfer amount must be positive.');
    if (!data.documentRef?.trim()) throw new Error('Document reference is required for transfer.');
    if (data.transferFromType === data.transferToType && data.transferFromId === data.transferToId) {
      throw new Error('Source and destination accounts cannot be identical.');
    }

    const client = this.requireClient();
    const fromName = this.getAccountName(data.transferFromType, data.transferFromId);
    const toName = this.getAccountName(data.transferToType, data.transferToId);

    const { data: row, error } = await client.rpc('create_transfer', {
      payload: {
        date: data.date,
        transferFromType: data.transferFromType,
        transferFromId: data.transferFromId,
        transferToType: data.transferToType,
        transferToId: data.transferToId,
        amount: data.amount,
        documentRef: data.documentRef.trim(),
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        remarks: data.remarks,
        entryNumber: generateUniqueRef('JE-XFER'),
        journalDescription: `Internal Transfer: ${fromName} -> ${toName}`,
        debitAccount: `${toName} (${data.transferToType.toUpperCase()})`,
        creditAccount: `${fromName} (${data.transferFromType.toUpperCase()})`,
        auditDetails: `Transferred OMR ${data.amount} from "${fromName}" to "${toName}".`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.transfers.find((t) => t.id === row.id) || this.mapTransfer(row);
  }

  // -------------------------------------------------------------
  // 7. OPENING BALANCES
  // -------------------------------------------------------------
  public async setOpeningBalance(data: {
    accountType: 'bank' | 'cash' | 'petty_cash' | 'customer' | 'vendor' | 'other';
    accountId: string;
    openingDate: string;
    amount: number;
    documentRef?: string;
    remarks?: string;
  }): Promise<OpeningBalanceEntry> {
    const client = this.requireClient();
    let name = 'Account';
    if (data.accountType === 'bank') name = this.state.bankAccounts.find((b) => b.id === data.accountId)?.accountName || name;
    else if (data.accountType === 'cash') name = this.state.cashAccounts.find((c) => c.id === data.accountId)?.accountName || name;
    else if (data.accountType === 'petty_cash') name = this.state.pettyCashAccounts.find((p) => p.id === data.accountId)?.accountName || name;
    else if (data.accountType === 'customer') name = this.state.customers.find((c) => c.id === data.accountId)?.name || name;
    else if (data.accountType === 'vendor') name = this.state.vendors.find((v) => v.id === data.accountId)?.name || name;

    const { data: row, error } = await client.rpc('set_opening_balance', {
      payload: {
        accountType: data.accountType,
        accountId: data.accountId,
        openingDate: data.openingDate,
        amount: data.amount,
        documentRef: data.documentRef,
        remarks: data.remarks,
        auditDetails: `Set opening balance for ${name} (${data.accountType}) to OMR ${data.amount}.`,
      },
    });
    if (error) throw new Error(error.message);

    await this.loadAll();
    return this.state.openingBalances.find((o) => o.id === row.id) || this.mapOpeningBalance(row);
  }

  // -------------------------------------------------------------
  // 8. MASTER CREATION METHODS
  // -------------------------------------------------------------
  public async createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    if (!data.code?.trim()) throw new Error('Project Code is required.');
    if (!data.name?.trim()) throw new Error('Project Name is required.');
    if (!data.customerId) throw new Error('Customer is required.');

    const client = this.requireClient();
    const { data: row, error } = await client
      .from('projects')
      .insert({
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        customer_id: data.customerId,
        contract_value: Number(data.contractValue) || 0,
        budget_cost: data.budgetCost ?? null,
        start_date: data.startDate,
        end_date: data.endDate || null,
        status: data.status,
        remarks: data.remarks || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? `Project Code "${data.code}" already exists.` : error.message);

    await this.persistAuditLog('CREATE_PROJECT', 'Projects', `Created project "${row.name}" (Code: ${row.code})`, row.code, row.id);
    await this.loadAll();
    return this.state.projects.find((p) => p.id === row.id) || this.mapProject(row);
  }

  public async createCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    if (!data.code?.trim()) throw new Error('Customer Code is required.');
    if (!data.name?.trim()) throw new Error('Customer Name is required.');

    const client = this.requireClient();
    const { data: row, error } = await client
      .from('customers')
      .insert({
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        vatin: data.vatin || null,
        contact_person: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        opening_balance: Number(data.openingBalance) || 0,
        status: data.status,
        remarks: data.remarks || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? `Customer Code "${data.code}" already exists.` : error.message);

    await this.persistAuditLog('CREATE_CUSTOMER', 'Customers & Receivables', `Created customer "${row.name}" (${row.code})`, row.code, row.id);
    await this.loadAll();
    return this.state.customers.find((c) => c.id === row.id) || this.mapCustomer(row);
  }

  public async createVendor(data: Omit<Vendor, 'id' | 'createdAt'>): Promise<Vendor> {
    if (!data.code?.trim()) throw new Error('Vendor Code is required.');
    if (!data.name?.trim()) throw new Error('Vendor Name is required.');

    const client = this.requireClient();
    const { data: row, error } = await client
      .from('vendors')
      .insert({
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        category: data.category || null,
        vatin: data.vatin || null,
        contact_person: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        opening_balance: Number(data.openingBalance) || 0,
        status: data.status,
        remarks: data.remarks || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? `Vendor Code "${data.code}" already exists.` : error.message);

    await this.persistAuditLog('CREATE_VENDOR', 'Purchases & Payables', `Created vendor "${row.name}" (${row.code})`, row.code, row.id);
    await this.loadAll();
    return this.state.vendors.find((v) => v.id === row.id) || this.mapVendor(row);
  }

  public async createBankAccount(data: Omit<BankAccount, 'id' | 'currentBalance' | 'createdAt'>): Promise<BankAccount> {
    if (!data.bankName?.trim()) throw new Error('Bank Name is required.');
    if (!data.accountName?.trim()) throw new Error('Account Name is required.');

    const client = this.requireClient();
    const opening = Number(data.openingBalance) || 0;
    const { data: row, error } = await client
      .from('bank_accounts')
      .insert({
        bank_name: data.bankName.trim(),
        account_name: data.accountName.trim(),
        account_number: data.accountNumber || null,
        iban: data.iban || null,
        branch: data.branch || null,
        currency: 'OMR',
        opening_balance: opening,
        current_balance: opening,
        opening_date: data.openingDate || new Date().toISOString().split('T')[0],
        status: data.status,
        remarks: data.remarks || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await this.persistAuditLog('CREATE_BANK_ACCOUNT', 'Banking & Treasury', `Created bank account "${row.account_name}" at ${row.bank_name}`, row.account_number, row.id);
    await this.loadAll();
    return this.state.bankAccounts.find((b) => b.id === row.id) || this.mapBankAccount(row);
  }

  public async createBusinessPartner(data: Omit<BusinessPartner, 'id' | 'currentBalance' | 'createdAt'>): Promise<BusinessPartner> {
    if (!data.code?.trim()) throw new Error('Business Partner Code is required.');
    if (!data.name?.trim()) throw new Error('Business Partner Name is required.');

    const client = this.requireClient();
    const opening = Number(data.openingBalance) || 0;
    const { data: row, error } = await client
      .from('business_partners')
      .insert({
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        partner_type: data.partnerType,
        contact_person: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        opening_balance: opening,
        current_balance: opening,
        status: data.status,
        remarks: data.remarks || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? `Business Partner Code "${data.code}" already exists.` : error.message);

    await this.persistAuditLog('CREATE_BUSINESS_PARTNER', 'Business Partners', `Created business partner "${row.name}" (${row.code})`, row.code, row.id);
    await this.loadAll();
    return this.state.businessPartners.find((p) => p.id === row.id) || this.mapBusinessPartner(row);
  }

  public async createCashAccount(data: Omit<CashAccount, 'id' | 'currentBalance' | 'createdAt'>): Promise<CashAccount> {
    if (!data.accountName?.trim()) throw new Error('Cash Account Name is required.');

    const client = this.requireClient();
    const opening = Number(data.openingBalance) || 0;
    const { data: row, error } = await client
      .from('cash_accounts')
      .insert({
        account_name: data.accountName.trim(),
        opening_balance: opening,
        current_balance: opening,
        opening_date: data.openingDate || new Date().toISOString().split('T')[0],
        status: data.status || 'active',
        remarks: data.remarks?.trim() || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await this.persistAuditLog('CREATE_CASH_ACCOUNT', 'Banking & Treasury', `Created Cash in Hand account "${row.account_name}"`, 'Cash in Hand', row.id);
    await this.loadAll();
    return this.state.cashAccounts.find((c) => c.id === row.id) || this.mapCashAccount(row);
  }

  public async createPettyCashAccount(data: Omit<PettyCashAccount, 'id' | 'currentBalance' | 'createdAt'>): Promise<PettyCashAccount> {
    if (!data.accountName?.trim()) throw new Error('Petty Cash Account Name is required.');

    const client = this.requireClient();
    const opening = Number(data.openingBalance) || 0;
    const { data: row, error } = await client
      .from('petty_cash_accounts')
      .insert({
        account_name: data.accountName.trim(),
        opening_balance: opening,
        current_balance: opening,
        opening_date: data.openingDate || new Date().toISOString().split('T')[0],
        status: data.status || 'active',
        remarks: data.remarks?.trim() || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await this.persistAuditLog('CREATE_PETTY_CASH_ACCOUNT', 'Banking & Treasury', `Created Petty Cash account "${row.account_name}"`, 'Petty Cash', row.id);
    await this.loadAll();
    return this.state.pettyCashAccounts.find((p) => p.id === row.id) || this.mapPettyCashAccount(row);
  }

  public async createExpenseHead(data: Omit<ExpenseHead, 'id'>): Promise<ExpenseHead> {
    if (!data.name?.trim()) throw new Error('Expense category name is required.');
    const trimmedName = data.name.trim();

    const client = this.requireClient();
    const { data: row, error } = await client
      .from('expense_heads')
      .insert({
        name: trimmedName,
        category: data.category?.trim() || 'Direct Project Cost',
        status: data.status || 'active',
        remarks: data.description?.trim() || data.remarks?.trim() || null,
        created_by: authService.getCurrentUser()?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? `Expense category "${trimmedName}" already exists.` : error.message);

    await this.persistAuditLog('CREATE_EXPENSE_HEAD', 'Masters & Settings', `Created expense category "${row.name}" under grouping "${row.category}"`, undefined, row.id);
    await this.loadAll();
    return this.state.expenseHeads.find((h) => h.id === row.id) || this.mapExpenseHead(row);
  }

  public async updateExpenseHead(id: string, updates: Partial<Omit<ExpenseHead, 'id'>>): Promise<ExpenseHead> {
    const head = this.state.expenseHeads.find((h) => h.id === id);
    if (!head) throw new Error('Expense category not found.');

    const client = this.requireClient();
    const patch: Record<string, any> = {};
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) throw new Error('Expense category name cannot be empty.');
      patch.name = trimmedName;
    }
    if (updates.category !== undefined) patch.category = updates.category.trim();
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.description !== undefined || updates.remarks !== undefined) {
      patch.remarks = updates.description?.trim() || updates.remarks?.trim() || null;
    }

    const { data: row, error } = await client.from('expense_heads').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.code === '23505' ? `Expense category "${patch.name}" already exists.` : error.message);

    await this.persistAuditLog('UPDATE_EXPENSE_HEAD', 'Masters & Settings', `Updated expense category "${row.name}" (${row.category})`, undefined, row.id);
    await this.loadAll();
    return this.state.expenseHeads.find((h) => h.id === id) || this.mapExpenseHead(row);
  }

  public async deleteExpenseHead(id: string): Promise<void> {
    const head = this.state.expenseHeads.find((h) => h.id === id);
    if (!head) throw new Error('Expense category not found.');

    const hasExpenses = this.state.directExpenses.some((e) => e.expenseHeadId === id);
    const hasMoneyOut = this.state.moneyOutList.some((m) => m.expenseHeadId === id);
    if (hasExpenses || hasMoneyOut) {
      throw new Error(`Cannot delete category "${head.name}" because transactions are recorded against it. You can mark it inactive instead.`);
    }

    const client = this.requireClient();
    const { error } = await client.from('expense_heads').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await this.persistAuditLog('DELETE_EXPENSE_HEAD', 'Masters & Settings', `Deleted expense category "${head.name}"`, undefined, id);
    await this.loadAll();
  }

  // -------------------------------------------------------------
  // 9. REVERSAL / VOID TRANSACTION (server-enforced via reverse_transaction RPC)
  // -------------------------------------------------------------
  public async reverseTransaction(typeOrId: string, idOrReason: string, maybeReason?: string): Promise<void> {
    let type = typeOrId;
    let id = idOrReason;
    let reason = maybeReason || '';

    if (!maybeReason) {
      id = typeOrId;
      reason = idOrReason;
      if (this.state.clientInvoices.some((i) => i.id === id)) type = 'invoices';
      else if (this.state.purchases.some((p) => p.id === id)) type = 'purchases';
      else if (this.state.moneyInList.some((m) => m.id === id)) type = 'money_in';
      else if (this.state.moneyOutList.some((m) => m.id === id)) type = 'money_out';
      else if (this.state.directExpenses.some((e) => e.id === id)) type = 'expenses';
      else if (this.state.transfers.some((t) => t.id === id)) type = 'transfers';
      else throw new Error('Transaction not found');
    } else {
      // Normalize legacy singular module names to the RPC's module keys.
      const moduleMap: Record<string, string> = {
        invoice: 'invoices', purchase: 'purchases', money_in: 'money_in',
        money_out: 'money_out', expense: 'expenses', transfer: 'transfers',
      };
      type = moduleMap[type] || type;
    }

    if (!reason?.trim()) throw new Error('Reversal reason is required.');

    const client = this.requireClient();
    const { error } = await client.rpc('reverse_transaction', { p_module: type, p_id: id, p_reason: reason });
    if (error) throw new Error(error.message);

    await this.loadAll();
  }

  // -------------------------------------------------------------
  // APPROVAL WORKFLOW STATE TRANSITIONS (server-enforced via transition_transaction RPC)
  // -------------------------------------------------------------
  public async transitionTransaction(
    module: 'invoices' | 'purchases' | 'money_in' | 'money_out' | 'expenses',
    id: string,
    action: 'submit' | 'approve' | 'reject' | 'post',
    reason?: string
  ): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.rpc('transition_transaction', { p_module: module, p_id: id, p_action: action, p_reason: reason });
    if (error) throw new Error(error.message);
    await this.loadAll();
  }

  /** @deprecated retained for existing call sites; prefer transitionTransaction() which is server-enforced. */
  public async updateTransactionWorkflowStatus(
    id: string,
    status: TransactionStatus,
    meta: {
      submittedBy?: string; submittedAt?: string; approvedBy?: string; approvedByName?: string;
      approvedAt?: string; postedBy?: string; postedAt?: string; rejectionReason?: string;
    }
  ): Promise<void> {
    const moduleForId = (id: string): 'invoices' | 'purchases' | 'money_in' | 'money_out' | 'expenses' | null => {
      if (this.state.clientInvoices.some((x) => x.id === id)) return 'invoices';
      if (this.state.purchases.some((x) => x.id === id)) return 'purchases';
      if (this.state.moneyInList.some((x) => x.id === id)) return 'money_in';
      if (this.state.moneyOutList.some((x) => x.id === id)) return 'money_out';
      if (this.state.directExpenses.some((x) => x.id === id)) return 'expenses';
      return null;
    };
    const module = moduleForId(id);
    if (!module) return;

    const actionForStatus: Record<string, 'submit' | 'approve' | 'reject' | 'post'> = {
      submitted: 'submit', approved: 'approve', rejected: 'reject', posted: 'post',
    };
    const action = actionForStatus[status];
    if (!action) return;

    await this.transitionTransaction(module, id, action, meta.rejectionReason);
  }

  // -------------------------------------------------------------
  // AUDIT LOG
  // -------------------------------------------------------------
  private async persistAuditLog(action: string, module: string, details: string, docRef?: string, txId?: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const authUser = authService.getCurrentUser();
    await client.from('audit_logs').insert({
      user_id: authUser?.id,
      user_name: authUser?.fullName || 'Unknown User',
      user_role: authUser?.roleCode || 'unknown',
      action,
      module,
      transaction_id: txId,
      document_ref: docRef,
      details,
    });
  }

  public addAuditLog(action: string, module: string, details: string, docRef?: string, txId?: string): void {
    this.persistAuditLog(action, module, details, docRef, txId).then(() => this.loadAll());
  }

  public getJournalEntries(): JournalEntry[] {
    return [...this.state.journalEntries];
  }

  // -------------------------------------------------------------
  // 11. DYNAMIC CONSOLIDATED LEDGERS
  // -------------------------------------------------------------

  /**
   * Project Consolidated Ledger
   * Shows every transaction related to a project in chronological order
   */
  public getProjectLedger(projectId?: string): ProjectLedgerEntry[] {
    const entries: ProjectLedgerEntry[] = [];

    // 1. Client Invoices / IPCs
    this.state.clientInvoices
      .filter((i) => !projectId || i.projectId === projectId)
      .forEach((i) => {
        entries.push({
          id: 'pledger-' + i.id,
          projectId: i.projectId,
          date: i.date,
          transactionType: 'Invoice / IPC',
          documentRef: i.documentRef,
          partyName: i.customerName,
          description: `${i.invoiceType} #${i.invoiceNumber}: ${i.description}`,
          income: i.amount,
          purchase: 0,
          expense: 0,
          payment: 0,
          receipt: 0,
          netImpact: i.amount,
          status: i.status,
          remarks: i.remarks,
        });
      });

    // 2. Client Receipts (Money In)
    this.state.moneyInList
      .filter((m) => !projectId || m.projectId === projectId)
      .forEach((m) => {
        entries.push({
          id: 'pledger-' + m.id,
          projectId: m.projectId,
          date: m.transactionDate,
          transactionType: 'Client Receipt',
          documentRef: m.documentRef,
          partyName: m.customerName || m.receivedFrom,
          description: `Client Payment (${m.accountName})`,
          income: 0,
          purchase: 0,
          expense: 0,
          payment: 0,
          receipt: m.amount,
          netImpact: 0, // Receipts impact cash & customer receivable, NOT project revenue! (Anti-double-counting)
          status: m.status,
          remarks: m.remarks,
        });
      });

    // 3. Vendor Purchases
    this.state.purchases
      .filter((p) => !projectId || p.projectId === projectId)
      .forEach((p) => {
        entries.push({
          id: 'pledger-' + p.id,
          projectId: p.projectId,
          date: p.date,
          transactionType: 'Purchase',
          documentRef: p.documentRef,
          partyName: p.vendorName,
          description: `Purchase #${p.purchaseInvoiceNumber}: ${p.description}`,
          income: 0,
          purchase: p.amount,
          expense: 0,
          payment: 0,
          receipt: 0,
          netImpact: -p.amount,
          status: p.status,
          remarks: p.remarks,
        });
      });

    // 4. Vendor Payments (Money Out)
    this.state.moneyOutList
      .filter((m) => !projectId || m.projectId === projectId)
      .forEach((m) => {
        entries.push({
          id: 'pledger-' + m.id,
          projectId: m.projectId || '',
          date: m.transactionDate,
          transactionType: 'Vendor Payment',
          documentRef: m.documentRef,
          partyName: m.vendorName || m.paidTo,
          description: `Vendor Payment via ${m.accountName} (For: ${m.paymentFor})`,
          income: 0,
          purchase: 0,
          expense: 0,
          payment: m.amount,
          receipt: 0,
          netImpact: 0, // Payment settles payable and cash, NOT additional project cost! (Anti-double-counting)
          status: m.status,
          remarks: m.remarks,
        });
      });

    // 5. Direct Expenses
    this.state.directExpenses
      .filter((e) => !projectId || e.projectId === projectId)
      .forEach((e) => {
        entries.push({
          id: 'pledger-' + e.id,
          projectId: e.projectId,
          date: e.expenseDate,
          transactionType: 'Direct Expense',
          documentRef: e.documentRef,
          partyName: e.expenseHeadName,
          description: `${e.expenseHeadName}: ${e.description} (${e.accountName})`,
          income: 0,
          purchase: 0,
          expense: e.amount,
          payment: 0,
          receipt: 0,
          netImpact: -e.amount,
          status: e.status,
          remarks: e.remarks,
        });
      });

    // Sort chronologically ascending and calculate cumulative profit
    let cumulativeProfit = 0;
    return entries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => {
        const revenue = entry.income;
        const cost = addMoney(entry.purchase, entry.expense);
        cumulativeProfit = addMoney(cumulativeProfit, subtractMoney(revenue, cost));

        return {
          ...entry,
          type: entry.transactionType,
          party: entry.partyName,
          revenue,
          cost,
          cashReceived: entry.receipt,
          cashPaid: entry.payment > 0 ? entry.payment : (entry.transactionType === 'Direct Expense' ? entry.expense : 0),
          cumulativeProfit,
        };
      });
  }

  /**
   * Customer Ledger
   * Shows Invoices (+), Receipts (-), and running Outstanding
   */
  public getCustomerLedger(customerId?: string): CustomerLedgerEntry[] {
    const rawItems: {
      date: string;
      customerId: string;
      projectId?: string;
      projectName?: string;
      documentRef: string;
      invoiceNumber?: string;
      invoiceAmount: number;
      receiptAmount: number;
      paymentSource?: string;
      remarks?: string;
      status: TransactionStatus;
    }[] = [];

    // Invoices
    this.state.clientInvoices
      .filter((i) => !customerId || i.customerId === customerId)
      .forEach((i) => {
        rawItems.push({
          date: i.date,
          customerId: i.customerId,
          projectId: i.projectId,
          projectName: i.projectName,
          documentRef: i.documentRef,
          invoiceNumber: i.invoiceNumber,
          invoiceAmount: i.status === 'reversed' ? 0 : i.amount,
          receiptAmount: 0,
          remarks: i.remarks || i.description,
          status: i.status,
        });
      });

    // Receipts
    this.state.moneyInList
      .filter((m) => m.customerId && (!customerId || m.customerId === customerId))
      .forEach((m) => {
        rawItems.push({
          date: m.transactionDate,
          customerId: m.customerId!,
          projectId: m.projectId,
          projectName: m.projectName,
          documentRef: m.documentRef,
          invoiceNumber: m.invoiceNumber,
          invoiceAmount: 0,
          receiptAmount: m.status === 'reversed' ? 0 : m.amount,
          paymentSource: m.accountName,
          remarks: m.remarks,
          status: m.status,
        });
      });

    // Sort chronologically
    rawItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningOutstanding = 0;
    return rawItems.map((item, idx) => {
      runningOutstanding = addMoney(runningOutstanding, item.invoiceAmount);
      runningOutstanding = subtractMoney(runningOutstanding, item.receiptAmount);

      return {
        id: 'c-ledger-' + idx,
        customerId: item.customerId,
        date: item.date,
        type: item.invoiceAmount > 0 ? 'Invoice / IPC' : 'Client Receipt',
        projectId: item.projectId,
        projectName: item.projectName,
        documentRef: item.documentRef,
        invoiceOrIpcNumber: item.invoiceNumber,
        description: item.remarks || (item.invoiceNumber ? `Invoice #${item.invoiceNumber}` : 'Payment Received'),
        invoiceAmount: item.invoiceAmount,
        receiptAmount: item.receiptAmount,
        invoiced: item.invoiceAmount,
        received: item.receiptAmount,
        paymentSource: item.paymentSource,
        outstanding: runningOutstanding,
        remarks: item.remarks,
        status: item.status,
      };
    });
  }

  /**
   * Vendor Ledger
   * Shows Purchases (+), Payments (-), and running Outstanding
   */
  public getVendorLedger(vendorId?: string): VendorLedgerEntry[] {
    const rawItems: {
      date: string;
      vendorId: string;
      projectId?: string;
      projectName?: string;
      purchaseReference?: string;
      purchaseAmount: number;
      paymentAmount: number;
      paymentSource?: string;
      documentRef: string;
      remarks?: string;
      status: TransactionStatus;
    }[] = [];

    // Purchases
    this.state.purchases
      .filter((p) => !vendorId || p.vendorId === vendorId)
      .forEach((p) => {
        rawItems.push({
          date: p.date,
          vendorId: p.vendorId,
          projectId: p.projectId,
          projectName: p.projectName,
          purchaseReference: p.purchaseInvoiceNumber,
          purchaseAmount: p.status === 'reversed' ? 0 : p.amount,
          paymentAmount: 0,
          documentRef: p.documentRef,
          remarks: p.remarks || p.description,
          status: p.status,
        });
      });

    // Payments
    this.state.moneyOutList
      .filter((m) => m.vendorId && (!vendorId || m.vendorId === vendorId))
      .forEach((m) => {
        rawItems.push({
          date: m.transactionDate,
          vendorId: m.vendorId!,
          projectId: m.projectId,
          projectName: m.projectName,
          purchaseReference: m.purchaseInvoiceNumber,
          purchaseAmount: 0,
          paymentAmount: m.status === 'reversed' ? 0 : m.amount,
          paymentSource: m.accountName,
          documentRef: m.documentRef,
          remarks: m.remarks,
          status: m.status,
        });
      });

    // Sort chronologically
    rawItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningOutstanding = 0;
    return rawItems.map((item, idx) => {
      runningOutstanding = addMoney(runningOutstanding, item.purchaseAmount);
      runningOutstanding = subtractMoney(runningOutstanding, item.paymentAmount);

      return {
        id: 'v-ledger-' + idx,
        vendorId: item.vendorId,
        date: item.date,
        type: item.purchaseAmount > 0 ? 'Purchase Bill' : 'Vendor Payment',
        projectId: item.projectId,
        projectName: item.projectName,
        purchaseReference: item.purchaseReference,
        description: item.remarks || (item.purchaseReference ? `Purchase #${item.purchaseReference}` : 'Payment Made'),
        purchaseAmount: item.purchaseAmount,
        paymentAmount: item.paymentAmount,
        purchased: item.purchaseAmount,
        paid: item.paymentAmount,
        paymentSource: item.paymentSource,
        documentRef: item.documentRef,
        outstanding: runningOutstanding,
        remarks: item.remarks,
        status: item.status,
      };
    });
  }

  private activeTreasuryAccountId: string = 'all';

  public setActiveTreasuryAccountId(id: string): void {
    this.activeTreasuryAccountId = id || 'all';
  }

  public getActiveTreasuryAccountId(): string {
    return this.activeTreasuryAccountId;
  }

  /**
   * Treasury Ledger for Bank, Cash or Petty Cash account
   * Supports both (accountType, accountId) and single-argument polymorphic usage (accountTypeOrId)
   */
  public getTreasuryLedger(accountTypeOrId?: TreasuryAccountType | string, accountIdParam?: string): TreasuryLedgerEntry[] {
    let effectiveType: TreasuryAccountType | undefined;
    let effectiveAccountId: string | undefined;

    if (accountIdParam) {
      effectiveType = accountTypeOrId as TreasuryAccountType;
      effectiveAccountId = accountIdParam;
    } else if (accountTypeOrId && accountTypeOrId !== 'all') {
      if (accountTypeOrId === 'bank' || accountTypeOrId === 'cash' || accountTypeOrId === 'petty_cash' || accountTypeOrId === 'partner') {
        effectiveType = accountTypeOrId as TreasuryAccountType;
      } else if (accountTypeOrId.startsWith('group:')) {
        effectiveType = accountTypeOrId.replace('group:', '') as TreasuryAccountType;
      } else {
        effectiveAccountId = accountTypeOrId;
        // Auto-detect type if this is an account ID
        if (this.state.bankAccounts.some((b) => b.id === effectiveAccountId)) {
          effectiveType = 'bank';
        } else if (this.state.cashAccounts.some((c) => c.id === effectiveAccountId)) {
          effectiveType = 'cash';
        } else if (this.state.pettyCashAccounts.some((p) => p.id === effectiveAccountId)) {
          effectiveType = 'petty_cash';
        } else if (this.state.businessPartners.some((p) => p.id === effectiveAccountId)) {
          effectiveType = 'partner';
        }
      }
    }

    const targetPartner = effectiveAccountId
      ? this.state.businessPartners.find((p) => p.id === effectiveAccountId)
      : undefined;

    const targetAccountObj = effectiveAccountId
      ? this.state.bankAccounts.find((b) => b.id === effectiveAccountId) ||
        this.state.cashAccounts.find((c) => c.id === effectiveAccountId) ||
        this.state.pettyCashAccounts.find((p) => p.id === effectiveAccountId) ||
        (targetPartner ? { ...targetPartner, accountName: targetPartner.name } : undefined)
      : undefined;

    const matchesAccount = (txType: TreasuryAccountType, txAccountId?: string, txAccountName?: string): boolean => {
      if (effectiveType && txType !== effectiveType) return false;
      if (effectiveAccountId) {
        if (txAccountId && txAccountId === effectiveAccountId) return true;
        if (txAccountName && targetAccountObj && txAccountName === targetAccountObj.accountName) return true;
        return false;
      }
      return true;
    };

    const rawItems: {
      accountType: TreasuryAccountType;
      accountId: string;
      accountName: string;
      date: string;
      type: 'Receipt from Client' | 'Payment to Vendors' | 'Transfer In' | 'Transfer Out' | 'Direct Expense' | 'Opening Balance' | string;
      documentRef: string;
      partyName?: string;
      description: string;
      inflow: number;
      outflow: number;
      status: TransactionStatus;
    }[] = [];

    // Opening Balances
    if (targetAccountObj) {
      if (targetAccountObj.openingBalance > 0) {
        rawItems.push({
          accountType: effectiveType || 'bank',
          accountId: targetAccountObj.id,
          accountName: targetAccountObj.accountName,
          date: (targetAccountObj as any).openingDate || '2026-01-01',
          type: 'Opening Balance',
          documentRef: `OB-${targetAccountObj.id.toUpperCase()}`,
          partyName: 'Opening Balance',
          description: `Opening Balance for ${targetAccountObj.accountName}`,
          inflow: targetAccountObj.openingBalance,
          outflow: 0,
          status: 'posted',
        });
      }
    } else {
      const allAccountsList = [
        ...this.state.bankAccounts.map((b) => ({ ...b, type: 'bank' as TreasuryAccountType })),
        ...this.state.cashAccounts.map((c) => ({ ...c, type: 'cash' as TreasuryAccountType })),
        ...this.state.pettyCashAccounts.map((p) => ({ ...p, type: 'petty_cash' as TreasuryAccountType })),
        ...this.state.businessPartners.map((p) => ({ ...p, accountName: p.name, type: 'partner' as TreasuryAccountType })),
      ];

      allAccountsList.forEach((acc) => {
        if ((!effectiveType || acc.type === effectiveType) && acc.openingBalance > 0) {
          rawItems.push({
            accountType: acc.type,
            accountId: acc.id,
            accountName: acc.accountName,
            date: (acc as any).openingDate || '2026-01-01',
            type: 'Opening Balance',
            documentRef: `OB-${acc.id.toUpperCase()}`,
            partyName: 'Opening Balance',
            description: `Opening Balance for ${acc.accountName}`,
            inflow: acc.openingBalance,
            outflow: 0,
            status: 'posted',
          });
        }
      });
    }

    // Money In
    this.state.moneyInList
      .filter((m) => matchesAccount(m.receivedInto, m.accountId, m.accountName))
      .forEach((m) => {
        rawItems.push({
          accountType: m.receivedInto,
          accountId: m.accountId,
          accountName: m.accountName,
          date: m.transactionDate,
          type: 'Receipt from Client',
          documentRef: m.documentRef,
          partyName: m.receivedFrom,
          description: `Receipt from ${m.receivedFrom} (${m.projectName})`,
          inflow: m.status === 'reversed' ? 0 : m.amount,
          outflow: 0,
          status: m.status,
        });
      });

    // Money Out
    this.state.moneyOutList
      .filter((m) => matchesAccount(m.paidFrom, m.accountId, m.accountName))
      .forEach((m) => {
        rawItems.push({
          accountType: m.paidFrom,
          accountId: m.accountId,
          accountName: m.accountName,
          date: m.transactionDate,
          type: 'Payment to Vendors',
          documentRef: m.documentRef,
          partyName: m.paidTo,
          description: `Payment to ${m.paidTo} (${m.paymentFor})`,
          inflow: 0,
          outflow: m.status === 'reversed' ? 0 : m.amount,
          status: m.status,
        });
      });

    // Direct Expenses
    this.state.directExpenses
      .filter((e) => matchesAccount(e.paidFrom, e.accountId, e.accountName))
      .forEach((e) => {
        rawItems.push({
          accountType: e.paidFrom,
          accountId: e.accountId,
          accountName: e.accountName,
          date: e.expenseDate,
          type: 'Direct Expense',
          documentRef: e.documentRef,
          partyName: e.expenseHeadName,
          description: `${e.expenseHeadName}: ${e.description}`,
          inflow: 0,
          outflow: e.status === 'reversed' ? 0 : e.amount,
          status: e.status,
        });
      });

    // Transfers
    this.state.transfers.forEach((t) => {
      // Outflow side
      if (matchesAccount(t.transferFromType, t.transferFromId, t.transferFromName)) {
        rawItems.push({
          accountType: t.transferFromType,
          accountId: t.transferFromId,
          accountName: t.transferFromName,
          date: t.date,
          type: 'Transfer Out',
          documentRef: t.documentRef,
          partyName: t.transferToName,
          description: `Transfer to ${t.transferToName}`,
          inflow: 0,
          outflow: t.status === 'reversed' ? 0 : t.amount,
          status: t.status,
        });
      }
      // Inflow side
      if (matchesAccount(t.transferToType, t.transferToId, t.transferToName)) {
        rawItems.push({
          accountType: t.transferToType,
          accountId: t.transferToId,
          accountName: t.transferToName,
          date: t.date,
          type: 'Transfer In',
          documentRef: t.documentRef,
          partyName: t.transferFromName,
          description: `Transfer from ${t.transferFromName}`,
          inflow: t.status === 'reversed' ? 0 : t.amount,
          outflow: 0,
          status: t.status,
        });
      }
    });

    // Sort chronologically
    rawItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    return rawItems.map((item, idx) => {
      runningBalance = addMoney(runningBalance, item.inflow);
      runningBalance = subtractMoney(runningBalance, item.outflow);

      return {
        id: 't-ledger-' + idx,
        accountType: item.accountType,
        accountId: item.accountId,
        accountName: item.accountName,
        date: item.date,
        type: item.type,
        documentRef: item.documentRef,
        partyName: item.partyName,
        party: item.partyName,
        description: item.description,
        inflow: item.inflow,
        outflow: item.outflow,
        receipt: item.inflow,
        payment: item.outflow,
        balanceAfter: runningBalance,
        runningBalance: runningBalance,
        status: item.status,
      };
    });
  }

  // -------------------------------------------------------------
  // 12. PROJECT PROFITABILITY & METRICS (ANTI-DOUBLE-COUNTING RULES)
  // -------------------------------------------------------------
  public getProjectProfitability(projectId: string): ProjectProfitability {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) {
      return {
        projectId,
        projectName: 'Unknown',
        projectCode: '',
        customerName: '',
        contractValue: 0,
        totalInvoiced: 0,
        totalReceived: 0,
        receivable: 0,
        outstandingReceivable: 0,
        totalPurchases: 0,
        totalVendorPaid: 0,
        totalVendorPayable: 0,
        totalExpenses: 0,
        totalProjectCost: 0,
        grossProfit: 0,
        profitMarginPercent: 0,
        profitMargin: 0,
      };
    }

    // 1. Total Invoiced (Project Revenue)
    const validInvoices = this.state.clientInvoices.filter(
      (i) => i.projectId === projectId && i.status !== 'reversed'
    );
    const totalInvoiced = validInvoices.reduce((sum, i) => addMoney(sum, i.amount), 0);

    // 2. Total Received
    const validReceipts = this.state.moneyInList.filter(
      (m) => m.projectId === projectId && m.status !== 'reversed'
    );
    const totalReceived = validReceipts.reduce((sum, m) => addMoney(sum, m.amount), 0);

    // 3. Receivable
    const receivable = Math.max(0, subtractMoney(totalInvoiced, totalReceived));

    // 4. Purchases
    const validPurchases = this.state.purchases.filter(
      (p) => p.projectId === projectId && p.status !== 'reversed'
    );
    const totalPurchases = validPurchases.reduce((sum, p) => addMoney(sum, p.amount), 0);

    // 5. Vendor Paid on this project
    const validPayments = this.state.moneyOutList.filter(
      (m) => m.projectId === projectId && m.paymentFor === 'purchase' && m.status !== 'reversed'
    );
    const totalVendorPaid = validPayments.reduce((sum, m) => addMoney(sum, m.amount), 0);

    // 6. Vendor Payable
    const totalVendorPayable = Math.max(0, subtractMoney(totalPurchases, totalVendorPaid));

    // 7. Direct Expenses
    const validExpenses = this.state.directExpenses.filter(
      (e) => e.projectId === projectId && e.status !== 'reversed'
    );
    const totalExpenses = validExpenses.reduce((sum, e) => addMoney(sum, e.amount), 0);

    // CRITICAL ANTI-DOUBLE-COUNTING:
    // Total Project Cost = Total Purchases + Direct Expenses
    // (Vendor payments are NOT project cost again!)
    const totalProjectCost = addMoney(totalPurchases, totalExpenses);

    // Gross Profit = Total Revenue (Invoiced) - Total Project Cost
    const grossProfit = subtractMoney(totalInvoiced, totalProjectCost);

    const profitMarginPercent =
      totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0;

    return {
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      customerName: project.customerName || '',
      contractValue: project.contractValue,
      totalInvoiced,
      totalReceived,
      receivable,
      outstandingReceivable: receivable,
      totalPurchases,
      totalVendorPaid,
      totalVendorPayable,
      totalExpenses,
      totalProjectCost,
      grossProfit,
      profitMarginPercent,
      profitMargin: profitMarginPercent,
    };
  }

  public getAllProjectProfitabilities(): ProjectProfitability[] {
    return this.state.projects.map((p) => this.getProjectProfitability(p.id));
  }

  // -------------------------------------------------------------
  // 13. GLOBAL DASHBOARD AGGREGATES
  // -------------------------------------------------------------
  public getDashboardStats() {
    const activeProjects = this.state.projects.filter((p) => p.status === 'active').length;

    let totalRevenue = 0;
    let totalPurchases = 0;
    let totalDirectExpenses = 0;
    let totalClientReceipts = 0;
    let totalVendorPayments = 0;

    this.state.clientInvoices.forEach((i) => {
      if (i.status !== 'reversed') totalRevenue = addMoney(totalRevenue, i.amount);
    });

    this.state.moneyInList.forEach((m) => {
      if (m.status !== 'reversed') totalClientReceipts = addMoney(totalClientReceipts, m.amount);
    });

    this.state.purchases.forEach((p) => {
      if (p.status !== 'reversed') totalPurchases = addMoney(totalPurchases, p.amount);
    });

    this.state.directExpenses.forEach((e) => {
      if (e.status !== 'reversed') totalDirectExpenses = addMoney(totalDirectExpenses, e.amount);
    });

    this.state.moneyOutList.forEach((m) => {
      if (m.paymentFor === 'purchase' && m.status !== 'reversed') {
        totalVendorPayments = addMoney(totalVendorPayments, m.amount);
      }
    });

    const totalProjectCost = addMoney(totalPurchases, totalDirectExpenses);
    const totalProjectProfit = subtractMoney(totalRevenue, totalProjectCost);
    const receivables = Math.max(0, subtractMoney(totalRevenue, totalClientReceipts));
    const payables = Math.max(0, subtractMoney(totalPurchases, totalVendorPayments));

    const bankBalance = this.state.bankAccounts.reduce(
      (sum, b) => (b.status === 'active' ? addMoney(sum, b.currentBalance) : sum),
      0
    );
    const cashInHand = this.state.cashAccounts.reduce(
      (sum, c) => (c.status === 'active' ? addMoney(sum, c.currentBalance) : sum),
      0
    );
    const pettyCash = this.state.pettyCashAccounts.reduce(
      (sum, p) => (p.status === 'active' ? addMoney(sum, p.currentBalance) : sum),
      0
    );

    return {
      totalProjects: this.state.projects.length,
      activeProjects,
      totalCustomers: this.state.customers.length,
      totalVendors: this.state.vendors.length,
      totalRevenue,
      totalPurchases,
      totalDirectExpenses,
      totalProjectCost,
      totalProjectProfit,
      receivables,
      payables,
      cashInflows: totalClientReceipts,
      cashOutflowsVendor: totalVendorPayments,
      cashOutflowsExpense: totalDirectExpenses,
      bankBalance,
      cashInHand,
      pettyCash,
    };
  }

  public getDashboardSummary() {
    const stats = this.getDashboardStats();
    const totalBankBalance = stats.bankBalance;
    const totalCashBalance = stats.cashInHand;
    const totalPettyCashBalance = stats.pettyCash;
    const totalLiquidFunds = addMoney(addMoney(totalBankBalance, totalCashBalance), totalPettyCashBalance);

    const totalRevenueInvoiced = stats.totalRevenue;
    const totalReceivables = stats.receivables;
    const totalPurchases = stats.totalPurchases;
    const totalPayables = stats.payables;
    const totalProjectCosts = stats.totalProjectCost;
    const netProfit = stats.totalProjectProfit;
    const profitMargin = totalRevenueInvoiced > 0 ? (netProfit / totalRevenueInvoiced) * 100 : 0;

    return {
      totalBankBalance,
      totalCashBalance,
      totalPettyCashBalance,
      totalLiquidFunds,
      totalRevenueInvoiced,
      totalReceivables,
      totalPurchases,
      totalDirectExpenses: stats.totalDirectExpenses,
      totalPayables,
      totalProjectCosts,
      netProfit,
      profitMargin,
      cashInflows: stats.cashInflows,
      cashOutflowsVendor: stats.cashOutflowsVendor,
      cashOutflowsExpense: stats.cashOutflowsExpense,
      ...stats,
    };
  }

  public getAllTransactions(): Transaction[] {
    const list: Transaction[] = [];

    // Client Invoices
    this.state.clientInvoices.forEach((inv) => {
      list.push({
        id: inv.id,
        date: inv.date,
        documentRef: inv.invoiceNumber,
        type: 'CLIENT_INVOICE' as const,
        projectId: inv.projectId,
        projectName: inv.projectName,
        customerId: inv.customerId,
        customerName: inv.customerName,
        description: inv.description,
        amount: inv.amount,
        status: inv.status,
        attachmentUrl: inv.attachmentUrl,
        createdBy: inv.createdBy,
        submittedBy: inv.submittedBy,
        approvedBy: inv.approvedBy,
        approvedByName: inv.approvedByName,
        approvedAt: inv.approvedAt,
        postedBy: inv.postedBy,
        postedAt: inv.postedAt,
        rejectionReason: inv.rejectionReason,
      });
    });

    // Purchases
    this.state.purchases.forEach((p) => {
      list.push({
        id: p.id,
        date: p.date,
        documentRef: p.purchaseInvoiceNumber || p.documentRef || p.id,
        type: 'PURCHASE' as const,
        projectId: p.projectId,
        projectName: p.projectName,
        vendorId: p.vendorId,
        vendorName: p.vendorName,
        description: p.description,
        amount: p.amount,
        status: p.status,
        attachmentUrl: p.attachmentUrl,
        createdBy: p.createdBy,
        submittedBy: p.submittedBy,
        approvedBy: p.approvedBy,
        approvedByName: p.approvedByName,
        approvedAt: p.approvedAt,
        postedBy: p.postedBy,
        postedAt: p.postedAt,
        rejectionReason: p.rejectionReason,
      });
    });

    // Money In
    this.state.moneyInList.forEach((m) => {
      list.push({
        id: m.id,
        date: m.transactionDate,
        documentRef: m.documentRef,
        type: 'MONEY_IN' as const,
        projectId: m.projectId,
        projectName: m.projectName,
        customerId: m.customerId,
        customerName: m.customerName,
        accountId: m.accountId,
        accountName: m.accountName,
        description: m.remarks || `Receipt from ${m.receivedFrom || m.customerName || 'Client'}`,
        amount: m.amount,
        status: m.status,
        attachmentUrl: m.attachmentUrl,
        createdBy: m.createdBy,
        submittedBy: m.submittedBy,
        approvedBy: m.approvedBy,
        approvedByName: m.approvedByName,
        approvedAt: m.approvedAt,
        postedBy: m.postedBy,
        postedAt: m.postedAt,
        rejectionReason: m.rejectionReason,
      });
    });

    // Money Out
    this.state.moneyOutList.forEach((m) => {
      list.push({
        id: m.id,
        date: m.transactionDate,
        documentRef: m.documentRef,
        type: 'MONEY_OUT' as const,
        projectId: m.projectId,
        projectName: m.projectName,
        vendorId: m.vendorId,
        vendorName: m.vendorName,
        accountId: m.accountId,
        accountName: m.accountName,
        description: m.remarks || `Payment to ${m.paidTo || m.vendorName || 'Vendor'}`,
        amount: m.amount,
        status: m.status,
        attachmentUrl: m.attachmentUrl,
        createdBy: m.createdBy,
        submittedBy: m.submittedBy,
        approvedBy: m.approvedBy,
        approvedByName: m.approvedByName,
        approvedAt: m.approvedAt,
        postedBy: m.postedBy,
        postedAt: m.postedAt,
        rejectionReason: m.rejectionReason,
      });
    });

    // Direct Expenses
    this.state.directExpenses.forEach((e) => {
      list.push({
        id: e.id,
        date: e.expenseDate,
        documentRef: e.documentRef,
        type: 'EXPENSE' as const,
        projectId: e.projectId,
        projectName: e.projectName,
        accountId: e.accountId,
        accountName: e.accountName,
        description: e.description,
        amount: e.amount,
        status: e.status,
        attachmentUrl: e.attachmentUrl,
        createdBy: e.createdBy,
        submittedBy: e.submittedBy,
        approvedBy: e.approvedBy,
        approvedByName: e.approvedByName,
        approvedAt: e.approvedAt,
        postedBy: e.postedBy,
        postedAt: e.postedAt,
        rejectionReason: e.rejectionReason,
      });
    });

    // Transfers
    this.state.transfers.forEach((t) => {
      list.push({
        id: t.id,
        date: t.date,
        documentRef: t.documentRef,
        type: 'TRANSFER' as const,
        accountName: `${t.transferFromName} → ${t.transferToName}`,
        description: t.remarks || 'Internal Transfer',
        amount: t.amount,
        status: t.status,
        attachmentUrl: t.attachmentUrl,
        createdBy: t.createdBy,
        submittedBy: t.submittedBy,
        approvedBy: t.approvedBy,
        approvedByName: t.approvedByName,
        approvedAt: t.approvedAt,
        postedBy: t.postedBy,
        postedAt: t.postedAt,
        rejectionReason: t.rejectionReason,
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const accountingService = new AccountingService();
export default accountingService;
