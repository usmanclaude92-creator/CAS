export type Currency = 'OMR';

export enum UserRole {
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  PROJECT_MANAGER = 'project_manager',
  SITE_ENGINEER = 'site_engineer',
  VIEWER = 'viewer',
}

export type UserRoleType = UserRole | 'admin' | 'accountant' | 'manager' | 'project_manager' | 'site_engineer' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
}

export type ProjectStatus = 'active' | 'completed' | 'inactive';

export interface Project {
  id: string;
  code: string; // Unique
  name: string;
  customerId: string;
  customerName?: string;
  contractValue: number;
  budgetCost?: number;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  remarks?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  code: string; // Unique
  name: string;
  vatin?: string; // VAT Identification Number
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance: number;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  code: string; // Unique
  name: string;
  category?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance: number;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: string;
}

export type TreasuryAccountType = 'bank' | 'cash' | 'petty_cash';

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  branch?: string;
  currency: Currency;
  openingBalance: number;
  currentBalance: number;
  openingDate?: string;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: string;
}

export interface CashAccount {
  id: string;
  accountName: string;
  openingBalance: number;
  currentBalance: number;
  openingDate?: string;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: string;
}

export interface PettyCashAccount {
  id: string;
  accountName: string;
  openingBalance: number;
  currentBalance: number;
  openingDate?: string;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: string;
}

export interface ExpenseHead {
  id: string;
  name: string;
  category?: string;
  description?: string;
  status: 'active' | 'inactive';
  remarks?: string;
}

export type ExpenseCategory = ExpenseHead;

export type TransactionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'posted'
  | 'reversed'
  | 'paid'
  | 'partially_paid'
  | 'unpaid';

export interface WorkflowRecord {
  createdBy?: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  postedBy?: string;
  postedAt?: string;
  rejectionReason?: string;
}

export interface ClientInvoice extends WorkflowRecord {
  id: string;
  invoiceType: 'IPC' | 'Invoice';
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  description: string;
  amount: number;
  documentRef: string;
  attachmentUrl?: string;
  attachmentName?: string;
  receivedAmount: number;
  outstandingAmount: number;
  status: TransactionStatus;
  remarks?: string;
  createdAt: string;
}

export interface Purchase extends WorkflowRecord {
  id: string;
  purchaseInvoiceNumber: string;
  date: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  purchaseCategory: string;
  description: string;
  amount: number;
  documentRef: string;
  attachmentUrl?: string;
  attachmentName?: string;
  paidAmount: number;
  outstandingAmount: number;
  status: TransactionStatus;
  remarks?: string;
  createdAt: string;
}

export interface MoneyIn extends WorkflowRecord {
  id: string;
  transactionDate: string;
  receivedFrom: string;
  customerId?: string;
  customerName?: string;
  projectId: string;
  projectName: string;
  against: 'invoice' | 'other';
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  receivedInto: TreasuryAccountType;
  accountId: string;
  accountName: string;
  documentRef: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: TransactionStatus;
  remarks?: string;
  createdAt: string;
}

export interface MoneyOut extends WorkflowRecord {
  id: string;
  transactionDate: string;
  paidTo: string;
  vendorId?: string;
  vendorName?: string;
  projectId?: string;
  projectName?: string;
  paymentFor: 'purchase' | 'expense' | 'other';
  purchaseId?: string;
  purchaseInvoiceNumber?: string;
  expenseHeadId?: string;
  expenseHeadName?: string;
  amount: number;
  paidFrom: TreasuryAccountType;
  accountId: string;
  accountName: string;
  documentRef: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: TransactionStatus;
  remarks?: string;
  createdAt: string;
}

export interface DirectExpense extends WorkflowRecord {
  id: string;
  expenseDate: string;
  projectId: string;
  projectName: string;
  projectCode?: string;
  expenseHeadId: string;
  expenseHeadName: string;
  description: string;
  amount: number;
  paidFrom: TreasuryAccountType;
  accountId: string;
  accountName: string;
  documentRef: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: TransactionStatus;
  remarks?: string;
  createdAt: string;
}

export interface AccountTransfer extends WorkflowRecord {
  id: string;
  date: string;
  transferFromType: TreasuryAccountType;
  transferFromId: string;
  transferFromName: string;
  transferToType: TreasuryAccountType;
  transferToId: string;
  transferToName: string;
  amount: number;
  documentRef: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: TransactionStatus;
  remarks?: string;
  createdAt: string;
}

export interface OpeningBalanceEntry {
  id: string;
  accountType: 'bank' | 'cash' | 'petty_cash' | 'customer' | 'vendor' | 'other';
  accountId: string;
  accountName: string;
  openingDate: string;
  amount: number;
  documentRef?: string;
  attachmentUrl?: string;
  remarks?: string;
  createdAt: string;
}

export interface ProjectLedgerEntry {
  id: string;
  projectId: string;
  date: string;
  transactionType: 'Invoice / IPC' | 'Client Receipt' | 'Purchase' | 'Vendor Payment' | 'Direct Expense' | 'Opening Balance' | string;
  type?: string;
  documentRef: string;
  partyName: string; // Customer or Vendor
  party?: string;
  description: string;
  income: number;
  purchase: number;
  expense: number;
  payment: number;
  receipt: number;
  revenue?: number;
  cost?: number;
  cashReceived?: number;
  cashPaid?: number;
  cumulativeProfit?: number;
  netImpact: number;
  status: TransactionStatus;
  remarks?: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  date: string;
  type?: string;
  projectId?: string;
  projectName?: string;
  documentRef: string;
  invoiceOrIpcNumber?: string;
  description?: string;
  invoiceAmount: number;
  receiptAmount: number;
  invoiced?: number;
  received?: number;
  paymentSource?: string;
  outstanding: number;
  remarks?: string;
  status: TransactionStatus;
}

export interface VendorLedgerEntry {
  id: string;
  vendorId: string;
  date: string;
  type?: string;
  projectId?: string;
  projectName?: string;
  purchaseReference?: string;
  description?: string;
  purchaseAmount: number;
  paymentAmount: number;
  purchased?: number;
  paid?: number;
  paymentSource?: string;
  documentRef: string;
  outstanding: number;
  remarks?: string;
  status: TransactionStatus;
}

export interface TreasuryLedgerEntry {
  id: string;
  accountType: TreasuryAccountType;
  accountId: string;
  accountName: string;
  date: string;
  type: 'Money In' | 'Money Out' | 'Transfer In' | 'Transfer Out' | 'Direct Expense' | 'Opening Balance' | string;
  documentRef: string;
  partyName?: string;
  party?: string;
  description: string;
  inflow: number;
  outflow: number;
  receipt?: number;
  payment?: number;
  balanceAfter: number;
  runningBalance?: number;
  status: TransactionStatus;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  sourceType: 'invoice' | 'money_in' | 'purchase' | 'money_out' | 'expense' | 'transfer' | 'opening';
  sourceId: string;
  projectId?: string;
  customerId?: string;
  vendorId?: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  transactionId?: string;
  documentRef?: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
  newValues?: any;
  oldValues?: any;
  details: string;
  ipAddress?: string;
}

export interface ProjectProfitability {
  projectId: string;
  projectName: string;
  projectCode: string;
  customerName: string;
  contractValue: number;
  totalInvoiced: number; // Revenue
  totalReceived: number;
  receivable: number;
  outstandingReceivable: number;
  totalPurchases: number;
  totalVendorPaid: number;
  totalVendorPayable: number;
  totalExpenses: number;
  totalProjectCost: number; // Purchases + Direct Expenses (Anti-double-counting!)
  grossProfit: number; // totalInvoiced - totalProjectCost
  profitMarginPercent: number; // (grossProfit / totalInvoiced) * 100
  profitMargin: number;
}

export type TransactionType = 'MONEY_IN' | 'MONEY_OUT' | 'CLIENT_INVOICE' | 'PURCHASE' | 'EXPENSE' | 'TRANSFER';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  documentRef: string;
  projectId?: string;
  projectName?: string;
  customerId?: string;
  customerName?: string;
  vendorId?: string;
  vendorName?: string;
  accountId?: string;
  accountName?: string;
  description: string;
  amount: number;
  status: TransactionStatus;
  attachmentUrl?: string;
  attachmentName?: string;
  remarks?: string;
  // Workflow audit and authority tracking
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  postedBy?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  rejectionReason?: string;
}
