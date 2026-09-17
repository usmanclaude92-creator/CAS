package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class UserRole(val displayName: String) {
    ADMIN("CFO / Admin"),
    ACCOUNTANT("Chief Accountant"),
    PROJECT_MANAGER("Project Manager"),
    SITE_ENGINEER("Site Engineer"),
    VIEWER("Auditor / Viewer")
}

enum class TransactionType(val label: String) {
    CLIENT_INVOICE("Client Invoice / IPC"),
    PURCHASE("Vendor Purchase / Bill"),
    MONEY_IN("Client Receipt (Inflow)"),
    MONEY_OUT("Vendor Payment (Outflow)"),
    DIRECT_EXPENSE("Direct Site Expense"),
    TRANSFER("Treasury Transfer")
}

enum class TransactionStatus(val label: String) {
    DRAFT("Draft"),
    SUBMITTED("Submitted"),
    APPROVED("Approved"),
    POSTED("Posted"),
    REJECTED("Rejected"),
    REVERSED("Reversed")
}

enum class AccountType(val label: String) {
    BANK("Bank Account"),
    CASH("Cash Account"),
    PETTY_CASH("Petty Cash")
}

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: String,
    val code: String,
    val name: String,
    val customerId: String,
    val customerName: String,
    val contractValue: Double,
    val budgetCost: Double = 0.0,
    val startDate: String,
    val endDate: String = "",
    val status: String = "active", // active, completed, inactive
    val remarks: String = "",
    val createdAt: String = ""
)

@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey val id: String,
    val code: String,
    val name: String,
    val contactPerson: String = "",
    val phone: String = "",
    val email: String = "",
    val address: String = "",
    val openingBalance: Double = 0.0,
    val status: String = "active",
    val remarks: String = "",
    val createdAt: String = ""
)

@Entity(tableName = "vendors")
data class VendorEntity(
    @PrimaryKey val id: String,
    val code: String,
    val name: String,
    val category: String = "Materials",
    val contactPerson: String = "",
    val phone: String = "",
    val email: String = "",
    val address: String = "",
    val openingBalance: Double = 0.0,
    val status: String = "active",
    val remarks: String = "",
    val createdAt: String = ""
)

@Entity(tableName = "accounts")
data class AccountEntity(
    @PrimaryKey val id: String,
    val accountType: AccountType,
    val bankName: String = "",
    val accountName: String,
    val accountNumber: String = "",
    val iban: String = "",
    val currency: String = "OMR",
    val openingBalance: Double = 0.0,
    val currentBalance: Double = 0.0,
    val status: String = "active",
    val remarks: String = "",
    val createdAt: String = ""
)

@Entity(tableName = "expense_heads")
data class ExpenseHeadEntity(
    @PrimaryKey val id: String,
    val name: String,
    val category: String = "Site Operations",
    val description: String = "",
    val status: String = "active"
)

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val id: String,
    val type: TransactionType,
    val date: String,
    val documentRef: String,
    val projectId: String = "",
    val projectName: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val vendorId: String = "",
    val vendorName: String = "",
    val accountId: String = "",
    val accountName: String = "",
    val toAccountId: String = "",
    val toAccountName: String = "",
    val expenseHeadId: String = "",
    val expenseHeadName: String = "",
    val description: String,
    val amount: Double,
    val receivedOrPaidAmount: Double = 0.0,
    val outstandingAmount: Double = 0.0,
    val status: TransactionStatus = TransactionStatus.SUBMITTED,
    val remarks: String = "",
    val createdBy: String = "System",
    val approvedBy: String = "",
    val rejectionReason: String = "",
    val createdAt: String = ""
)

@Entity(tableName = "audit_logs")
data class AuditLogEntity(
    @PrimaryKey val id: String,
    val timestamp: String,
    val userName: String,
    val userRole: String,
    val action: String,
    val module: String,
    val details: String
)

data class ProjectProfitability(
    val projectId: String,
    val projectCode: String,
    val projectName: String,
    val customerName: String,
    val contractValue: Double,
    val totalInvoiced: Double,
    val totalReceived: Double,
    val totalReceivable: Double,
    val totalPurchases: Double,
    val totalVendorPaid: Double,
    val totalVendorPayable: Double,
    val totalExpenses: Double,
    val totalCost: Double, // Purchases + Direct Expenses
    val grossProfit: Double, // totalInvoiced - totalCost
    val profitMarginPercent: Double
)

data class DashboardStats(
    val totalTreasuryBalance: Double,
    val accountsReceivable: Double,
    val accountsPayable: Double,
    val netCashPosition: Double,
    val totalContractValue: Double,
    val totalActiveProjects: Int,
    val pendingApprovalsCount: Int
)
