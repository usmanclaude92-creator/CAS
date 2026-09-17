export type SystemRole =
  | 'super_admin'
  | 'accounts_manager'
  | 'finance_manager'
  | 'accountant'
  | 'ar_user'
  | 'ap_user'
  | 'treasury_user'
  | 'project_accountant'
  | 'viewer';

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean; // Built-in system roles cannot be deleted
  permissions: string[]; // List of permission codes
  createdAt: string;
  updatedAt?: string;
}

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  fullName: string;
  mobile?: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  status: UserStatus;
  isDemo?: boolean; // Isolated sandbox demo user
  password?: string;
  lastPasswordChange?: string;
  forcePasswordReset?: boolean;
  twoFactorEnabled?: boolean;
  sessionStatus?: 'online' | 'offline' | 'idle';
  department?: string;
  employeeId?: string;
  assignedProjectIds: string[]; // empty array or ['*'] means All Projects
  isAllProjects: boolean;
  remarks?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserPreference {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  defaultLandingPage?: string;
  tablePageSize?: number;
  dateFormat?: string;
}

export interface ApprovalLimitConfig {
  roleCode: string;
  roleName: string;
  maxAmountOMR: number; // 0 for no approval authority, Infinity/999999999 for unlimited
}

export interface WorkflowSettings {
  separationOfDutiesEnabled: boolean; // Creator cannot approve own transaction
  requireApprovalAboveOMR: number; // e.g. 0 means all transactions require approval
  approvalLimits: ApprovalLimitConfig[];
}

export type ApprovalAction = 'submit' | 'approve' | 'reject' | 'post' | 'reverse';

export interface MasterImportAuditRecord {
  id: string;
  importType: 'customers' | 'vendors' | 'projects' | 'banks' | 'expense_heads';
  fileName: string;
  importedByUserId: string;
  importedByUserName: string;
  importedByUserEmail: string;
  timestamp: string;
  totalRows: number;
  newRecords: number;
  existingRecords: number;
  duplicateRecords: number;
  invalidRecords: number;
  skippedRecords: number;
  result: 'success' | 'partial' | 'failed';
  errorDetails?: string;
}
