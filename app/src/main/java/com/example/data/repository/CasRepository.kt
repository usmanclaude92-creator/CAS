package com.example.data.repository

import com.example.data.local.CasDao
import com.example.data.model.*
import com.example.data.remote.SupabaseClient
import com.example.data.sync.CasSyncManager
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class CasRepository(
    private val dao: CasDao,
    val supabaseClient: SupabaseClient,
    val syncManager: CasSyncManager
) {

    val allProjects: Flow<List<ProjectEntity>> = dao.getAllProjects()
    val allCustomers: Flow<List<CustomerEntity>> = dao.getAllCustomers()
    val allVendors: Flow<List<VendorEntity>> = dao.getAllVendors()
    val allAccounts: Flow<List<AccountEntity>> = dao.getAllAccounts()
    val allExpenseHeads: Flow<List<ExpenseHeadEntity>> = dao.getAllExpenseHeads()
    val allTransactions: Flow<List<TransactionEntity>> = dao.getAllTransactions()
    val allAuditLogs: Flow<List<AuditLogEntity>> = dao.getAllAuditLogs()

    private fun getCurrentTimestamp(): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
    }

    private fun getCurrentDate(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    suspend fun addProject(
        code: String,
        name: String,
        customerId: String,
        customerName: String,
        contractValue: Double,
        budgetCost: Double,
        startDate: String,
        remarks: String,
        user: String,
        role: String
    ) {
        val project = ProjectEntity(
            id = "prj-${UUID.randomUUID().toString().take(8)}",
            code = code,
            name = name,
            customerId = customerId,
            customerName = customerName,
            contractValue = contractValue,
            budgetCost = budgetCost,
            startDate = startDate.ifEmpty { getCurrentDate() },
            status = "active",
            remarks = remarks,
            createdAt = getCurrentTimestamp()
        )
        dao.insertProject(project)
        syncManager.pushProject(project)

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "CREATE_PROJECT",
                module = "Projects",
                details = "Created project ${project.code} - ${project.name} (Value: OMR $contractValue)"
            )
        )
    }

    suspend fun addCustomer(code: String, name: String, phone: String, email: String, user: String, role: String) {
        val customer = CustomerEntity(
            id = "cust-${UUID.randomUUID().toString().take(8)}",
            code = code,
            name = name,
            phone = phone,
            email = email,
            createdAt = getCurrentTimestamp()
        )
        dao.insertCustomer(customer)
        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "CREATE_CUSTOMER",
                module = "Masters",
                details = "Created Customer ${customer.name} (${customer.code})"
            )
        )
    }

    suspend fun addVendor(code: String, name: String, category: String, phone: String, email: String, user: String, role: String) {
        val vendor = VendorEntity(
            id = "vend-${UUID.randomUUID().toString().take(8)}",
            code = code,
            name = name,
            category = category,
            phone = phone,
            email = email,
            createdAt = getCurrentTimestamp()
        )
        dao.insertVendor(vendor)
        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "CREATE_VENDOR",
                module = "Masters",
                details = "Created Vendor ${vendor.name} (${vendor.category})"
            )
        )
    }

    suspend fun addAccount(
        accountType: AccountType,
        bankName: String,
        accountName: String,
        accountNumber: String,
        openingBalance: Double,
        user: String,
        role: String
    ) {
        val account = AccountEntity(
            id = "acc-${UUID.randomUUID().toString().take(8)}",
            accountType = accountType,
            bankName = bankName,
            accountName = accountName,
            accountNumber = accountNumber,
            openingBalance = openingBalance,
            currentBalance = openingBalance,
            createdAt = getCurrentTimestamp()
        )
        dao.insertAccount(account)
        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "CREATE_ACCOUNT",
                module = "Treasury",
                details = "Created ${account.accountType.label}: ${account.accountName} with initial balance OMR $openingBalance"
            )
        )
    }

    suspend fun addClientInvoice(
        docRef: String,
        projectId: String,
        projectName: String,
        customerId: String,
        customerName: String,
        description: String,
        amount: Double,
        user: String,
        role: String
    ) {
        val tx = TransactionEntity(
            id = "tx-inv-${UUID.randomUUID().toString().take(8)}",
            type = TransactionType.CLIENT_INVOICE,
            date = getCurrentDate(),
            documentRef = docRef,
            projectId = projectId,
            projectName = projectName,
            customerId = customerId,
            customerName = customerName,
            description = description,
            amount = amount,
            receivedOrPaidAmount = 0.0,
            outstandingAmount = amount,
            status = TransactionStatus.SUBMITTED,
            createdBy = user,
            createdAt = getCurrentTimestamp()
        )
        dao.insertTransaction(tx)
        syncManager.pushInvoice(tx)

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "SUBMIT_INVOICE",
                module = "Invoices",
                details = "Submitted Client IPC $docRef for $projectName (OMR $amount)"
            )
        )
    }

    suspend fun addPurchase(
        docRef: String,
        projectId: String,
        projectName: String,
        vendorId: String,
        vendorName: String,
        description: String,
        amount: Double,
        user: String,
        role: String
    ) {
        val tx = TransactionEntity(
            id = "tx-pur-${UUID.randomUUID().toString().take(8)}",
            type = TransactionType.PURCHASE,
            date = getCurrentDate(),
            documentRef = docRef,
            projectId = projectId,
            projectName = projectName,
            vendorId = vendorId,
            vendorName = vendorName,
            description = description,
            amount = amount,
            receivedOrPaidAmount = 0.0,
            outstandingAmount = amount,
            status = TransactionStatus.SUBMITTED,
            createdBy = user,
            createdAt = getCurrentTimestamp()
        )
        dao.insertTransaction(tx)
        syncManager.pushPurchase(tx)

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "SUBMIT_PURCHASE",
                module = "Purchases",
                details = "Submitted Purchase Bill $docRef from $vendorName (OMR $amount)"
            )
        )
    }

    suspend fun addDirectExpense(
        docRef: String,
        projectId: String,
        projectName: String,
        accountId: String,
        accountName: String,
        expenseHeadId: String,
        expenseHeadName: String,
        description: String,
        amount: Double,
        user: String,
        role: String
    ) {
        val tx = TransactionEntity(
            id = "tx-exp-${UUID.randomUUID().toString().take(8)}",
            type = TransactionType.DIRECT_EXPENSE,
            date = getCurrentDate(),
            documentRef = docRef,
            projectId = projectId,
            projectName = projectName,
            accountId = accountId,
            accountName = accountName,
            expenseHeadId = expenseHeadId,
            expenseHeadName = expenseHeadName,
            description = description,
            amount = amount,
            receivedOrPaidAmount = amount,
            outstandingAmount = 0.0,
            status = TransactionStatus.SUBMITTED,
            createdBy = user,
            createdAt = getCurrentTimestamp()
        )
        dao.insertTransaction(tx)

        val account = dao.getAccountById(accountId)
        if (account != null) {
            dao.updateAccount(account.copy(currentBalance = account.currentBalance - amount))
        }

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "RECORD_EXPENSE",
                module = "Expenses",
                details = "Recorded Site Expense $docRef: $expenseHeadName from $accountName (OMR $amount)"
            )
        )
    }

    suspend fun addMoneyIn(
        docRef: String,
        projectId: String,
        projectName: String,
        customerId: String,
        customerName: String,
        accountId: String,
        accountName: String,
        description: String,
        amount: Double,
        user: String,
        role: String
    ) {
        val tx = TransactionEntity(
            id = "tx-in-${UUID.randomUUID().toString().take(8)}",
            type = TransactionType.MONEY_IN,
            date = getCurrentDate(),
            documentRef = docRef,
            projectId = projectId,
            projectName = projectName,
            customerId = customerId,
            customerName = customerName,
            accountId = accountId,
            accountName = accountName,
            description = description,
            amount = amount,
            receivedOrPaidAmount = amount,
            outstandingAmount = 0.0,
            status = TransactionStatus.POSTED,
            createdBy = user,
            createdAt = getCurrentTimestamp()
        )
        dao.insertTransaction(tx)
        syncManager.pushMoneyIn(tx)

        val account = dao.getAccountById(accountId)
        if (account != null) {
            dao.updateAccount(account.copy(currentBalance = account.currentBalance + amount))
        }

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "RECEIPT_MONEY_IN",
                module = "Treasury",
                details = "Client receipt $docRef of OMR $amount deposited to $accountName"
            )
        )
    }

    suspend fun addMoneyOut(
        docRef: String,
        projectId: String,
        projectName: String,
        vendorId: String,
        vendorName: String,
        accountId: String,
        accountName: String,
        description: String,
        amount: Double,
        user: String,
        role: String
    ) {
        val tx = TransactionEntity(
            id = "tx-out-${UUID.randomUUID().toString().take(8)}",
            type = TransactionType.MONEY_OUT,
            date = getCurrentDate(),
            documentRef = docRef,
            projectId = projectId,
            projectName = projectName,
            vendorId = vendorId,
            vendorName = vendorName,
            accountId = accountId,
            accountName = accountName,
            description = description,
            amount = amount,
            receivedOrPaidAmount = amount,
            outstandingAmount = 0.0,
            status = TransactionStatus.POSTED,
            createdBy = user,
            createdAt = getCurrentTimestamp()
        )
        dao.insertTransaction(tx)
        syncManager.pushMoneyOut(tx)

        val account = dao.getAccountById(accountId)
        if (account != null) {
            dao.updateAccount(account.copy(currentBalance = account.currentBalance - amount))
        }

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "PAYMENT_MONEY_OUT",
                module = "Treasury",
                details = "Vendor payment $docRef of OMR $amount disbursed from $accountName to $vendorName"
            )
        )
    }

    suspend fun executeTransfer(
        docRef: String,
        fromAccountId: String,
        fromAccountName: String,
        toAccountId: String,
        toAccountName: String,
        amount: Double,
        remarks: String,
        user: String,
        role: String
    ) {
        val tx = TransactionEntity(
            id = "tx-trf-${UUID.randomUUID().toString().take(8)}",
            type = TransactionType.TRANSFER,
            date = getCurrentDate(),
            documentRef = docRef,
            accountId = fromAccountId,
            accountName = fromAccountName,
            toAccountId = toAccountId,
            toAccountName = toAccountName,
            description = "Inter-account Treasury Transfer: $fromAccountName -> $toAccountName",
            amount = amount,
            receivedOrPaidAmount = amount,
            outstandingAmount = 0.0,
            status = TransactionStatus.POSTED,
            remarks = remarks,
            createdBy = user,
            createdAt = getCurrentTimestamp()
        )
        dao.insertTransaction(tx)

        val fromAcc = dao.getAccountById(fromAccountId)
        if (fromAcc != null) {
            dao.updateAccount(fromAcc.copy(currentBalance = fromAcc.currentBalance - amount))
        }

        val toAcc = dao.getAccountById(toAccountId)
        if (toAcc != null) {
            dao.updateAccount(toAcc.copy(currentBalance = toAcc.currentBalance + amount))
        }

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "TREASURY_TRANSFER",
                module = "Treasury",
                details = "Transferred OMR $amount from $fromAccountName to $toAccountName"
            )
        )
    }

    suspend fun approveTransaction(tx: TransactionEntity, user: String, role: String) {
        val updated = tx.copy(
            status = TransactionStatus.APPROVED,
            approvedBy = "$user ($role)"
        )
        dao.updateTransaction(updated)
        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "APPROVE_TRANSACTION",
                module = "Approvals",
                details = "Approved ${tx.type.label} ${tx.documentRef} of OMR ${tx.amount}"
            )
        )
    }

    suspend fun postTransaction(tx: TransactionEntity, user: String, role: String) {
        val updated = tx.copy(
            status = TransactionStatus.POSTED
        )
        dao.updateTransaction(updated)
        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "POST_TRANSACTION",
                module = "Approvals",
                details = "Posted to Ledger: ${tx.type.label} ${tx.documentRef}"
            )
        )
    }

    suspend fun rejectTransaction(tx: TransactionEntity, reason: String, user: String, role: String) {
        val updated = tx.copy(
            status = TransactionStatus.REJECTED,
            rejectionReason = reason
        )
        dao.updateTransaction(updated)
        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "REJECT_TRANSACTION",
                module = "Approvals",
                details = "Rejected ${tx.type.label} ${tx.documentRef}. Reason: $reason"
            )
        )
    }

    suspend fun reverseTransaction(tx: TransactionEntity, reason: String, user: String, role: String) {
        val updated = tx.copy(
            status = TransactionStatus.REVERSED,
            rejectionReason = "REVERSED: $reason"
        )
        dao.updateTransaction(updated)

        if (tx.type == TransactionType.MONEY_IN && tx.accountId.isNotEmpty()) {
            dao.getAccountById(tx.accountId)?.let { acc ->
                dao.updateAccount(acc.copy(currentBalance = acc.currentBalance - tx.amount))
            }
        } else if ((tx.type == TransactionType.MONEY_OUT || tx.type == TransactionType.DIRECT_EXPENSE) && tx.accountId.isNotEmpty()) {
            dao.getAccountById(tx.accountId)?.let { acc ->
                dao.updateAccount(acc.copy(currentBalance = acc.currentBalance + tx.amount))
            }
        }

        dao.insertAuditLog(
            AuditLogEntity(
                id = UUID.randomUUID().toString(),
                timestamp = getCurrentTimestamp(),
                userName = user,
                userRole = role,
                action = "REVERSE_TRANSACTION",
                module = "Ledgers",
                details = "Reversed transaction ${tx.documentRef}. Reason: $reason"
            )
        )
    }
}
