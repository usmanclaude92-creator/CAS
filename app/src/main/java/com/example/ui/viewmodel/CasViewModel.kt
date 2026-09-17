package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.model.*
import com.example.data.repository.AuthRepository
import com.example.data.repository.CasRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class CasUiState(
    val projects: List<ProjectEntity> = emptyList(),
    val customers: List<CustomerEntity> = emptyList(),
    val vendors: List<VendorEntity> = emptyList(),
    val accounts: List<AccountEntity> = emptyList(),
    val expenseHeads: List<ExpenseHeadEntity> = emptyList(),
    val transactions: List<TransactionEntity> = emptyList(),
    val auditLogs: List<AuditLogEntity> = emptyList(),
    val currentUserProfile: UserProfile? = null,
    val isAuthenticated: Boolean = false,
    val currentUserRole: UserRole = UserRole.ADMIN,
    val currentUserName: String = "Chief Financial Officer",
    val searchQuery: String = "",
    val selectedProjectId: String? = null,
    val isAddProjectDialogOpen: Boolean = false,
    val isAddInvoiceDialogOpen: Boolean = false,
    val isAddPurchaseDialogOpen: Boolean = false,
    val isAddExpenseDialogOpen: Boolean = false,
    val isAddMoneyInDialogOpen: Boolean = false,
    val isAddMoneyOutDialogOpen: Boolean = false,
    val isTransferDialogOpen: Boolean = false,
    val isNewCustomerDialogOpen: Boolean = false,
    val isNewVendorDialogOpen: Boolean = false,
    val isNewAccountDialogOpen: Boolean = false,
    val isSupabaseDialogOpen: Boolean = false,
    val isSupabaseConfigured: Boolean = false,
    val supabaseUrl: String = "",
    val supabaseAnonKey: String = "",
    val isSyncing: Boolean = false,
    val syncStatusMessage: String = "Database ready in embedded local mode.",
    val userMessage: String? = null,
    val isDarkMode: Boolean? = null
)

class CasViewModel(
    private val repository: CasRepository,
    val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        CasUiState(
            isSupabaseConfigured = repository.supabaseClient.isConfigured(),
            supabaseUrl = repository.supabaseClient.supabaseUrl,
            supabaseAnonKey = repository.supabaseClient.supabaseAnonKey
        )
    )
    val uiState: StateFlow<CasUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch(Dispatchers.IO) {
            repository.checkAndSeedInitialData()
        }
        viewModelScope.launch {
            authRepository.currentUser.collect { user ->
                _uiState.update { current ->
                    if (user != null) {
                        current.copy(
                            currentUserProfile = user,
                            currentUserName = user.fullName,
                            currentUserRole = user.toUserRole(),
                            isAuthenticated = true
                        )
                    } else {
                        current.copy(
                            currentUserProfile = null,
                            isAuthenticated = false
                        )
                    }
                }
            }
        }
        viewModelScope.launch {
            combine(
                repository.allProjects,
                repository.allCustomers,
                repository.allVendors,
                repository.allAccounts,
                repository.allExpenseHeads,
                repository.allTransactions,
                repository.allAuditLogs
            ) { projects, customers, vendors, accounts, expenseHeads, transactions, auditLogs ->
                _uiState.update { current ->
                    current.copy(
                        projects = projects,
                        customers = customers,
                        vendors = vendors,
                        accounts = accounts,
                        expenseHeads = expenseHeads,
                        transactions = transactions,
                        auditLogs = auditLogs
                    )
                }
            }.collect()
        }
    }

    // Computed Dashboard KPIs
    val dashboardStats: StateFlow<DashboardStats> = _uiState.map { state ->
        val treasuryBalance = state.accounts.sumOf { it.currentBalance }

        // Receivable: Invoices where status = POSTED and outstanding > 0
        val accountsReceivable = state.transactions
            .filter { it.type == TransactionType.CLIENT_INVOICE && it.status == TransactionStatus.POSTED }
            .sumOf { it.outstandingAmount }

        // Payable: Purchases where status = POSTED and outstanding > 0
        val accountsPayable = state.transactions
            .filter { it.type == TransactionType.PURCHASE && it.status == TransactionStatus.POSTED }
            .sumOf { it.outstandingAmount }

        val netCashPosition = treasuryBalance + accountsReceivable - accountsPayable

        val pendingApprovals = state.transactions.count { it.status == TransactionStatus.SUBMITTED }

        DashboardStats(
            treasuryBalance = treasuryBalance,
            accountsReceivable = accountsReceivable,
            accountsPayable = accountsPayable,
            netCashPosition = netCashPosition,
            pendingApprovalsCount = pendingApprovals,
            totalProjects = state.projects.size
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardStats())

    // Project Profitability List
    val projectProfitabilities: StateFlow<List<ProjectProfitability>> = _uiState.map { state ->
        state.projects.map { project ->
            val projectTx = state.transactions.filter { it.projectId == project.id && it.status == TransactionStatus.POSTED }

            val totalInvoiced = projectTx.filter { it.type == TransactionType.CLIENT_INVOICE }.sumOf { it.amount }
            val totalReceived = projectTx.filter { it.type == TransactionType.MONEY_IN }.sumOf { it.amount }
            val totalReceivable = projectTx.filter { it.type == TransactionType.CLIENT_INVOICE }.sumOf { it.outstandingAmount }

            val totalPurchases = projectTx.filter { it.type == TransactionType.PURCHASE }.sumOf { it.amount }
            val totalVendorPaid = projectTx.filter { it.type == TransactionType.MONEY_OUT }.sumOf { it.amount }
            val totalVendorPayable = projectTx.filter { it.type == TransactionType.PURCHASE }.sumOf { it.outstandingAmount }

            val totalExpenses = projectTx.filter { it.type == TransactionType.DIRECT_EXPENSE }.sumOf { it.amount }

            // Cost avoids double counting between POs and disbursements: PO amount + Direct Expenses
            val totalCost = totalPurchases + totalExpenses
            val grossProfit = totalInvoiced - totalCost
            val profitMarginPercent = if (totalInvoiced > 0) (grossProfit / totalInvoiced) * 100.0 else 0.0

            ProjectProfitability(
                projectId = project.id,
                projectCode = project.code,
                projectName = project.name,
                customerName = project.customerName,
                contractValue = project.contractValue,
                budgetCost = project.budgetCost,
                totalInvoiced = totalInvoiced,
                totalReceived = totalReceived,
                totalReceivable = totalReceivable,
                totalPurchases = totalPurchases,
                totalVendorPaid = totalVendorPaid,
                totalVendorPayable = totalVendorPayable,
                totalExpenses = totalExpenses,
                totalCost = totalCost,
                grossProfit = grossProfit,
                profitMarginPercent = profitMarginPercent
            )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Supabase Cloud Configuration
    fun setSupabaseDialog(open: Boolean) {
        _uiState.update { it.copy(isSupabaseDialogOpen = open) }
    }

    fun saveSupabaseConfig(url: String, key: String) {
        repository.supabaseClient.supabaseUrl = url
        repository.supabaseClient.supabaseAnonKey = key
        val configured = repository.supabaseClient.isConfigured()
        _uiState.update {
            it.copy(
                supabaseUrl = url,
                supabaseAnonKey = key,
                isSupabaseConfigured = configured,
                syncStatusMessage = if (configured) "Supabase configured. Ready to sync." else "Offline Local Mode."
            )
        }
    }

    fun testSupabaseConnection(onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            val result = repository.supabaseClient.testConnection()
            _uiState.update { it.copy(syncStatusMessage = result.second) }
            onResult(result.first, result.second)
        }
    }

    fun syncDatabase() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, syncStatusMessage = "Connecting to CAS Supabase...") }
            val (success, message) = repository.syncManager.syncAll()
            _uiState.update {
                it.copy(
                    isSyncing = false,
                    syncStatusMessage = message,
                    userMessage = message
                )
            }
        }
    }

    fun disconnectSupabase() {
        repository.supabaseClient.supabaseUrl = ""
        repository.supabaseClient.supabaseAnonKey = ""
        _uiState.update {
            it.copy(
                supabaseUrl = "",
                supabaseAnonKey = "",
                isSupabaseConfigured = false,
                syncStatusMessage = "Disconnected from cloud. Running in local mode."
            )
        }
    }

    // Role switcher
    fun switchRole(role: UserRole) {
        val name = when (role) {
            UserRole.ADMIN -> "Chief Financial Officer"
            UserRole.ACCOUNTANT -> "Chief Accountant"
            UserRole.PROJECT_MANAGER -> "Senior Project Manager"
            UserRole.SITE_ENGINEER -> "Lead Site Engineer"
            UserRole.VIEWER -> "Financial Auditor"
        }
        _uiState.update { it.copy(currentUserRole = role, currentUserName = name) }
    }

    fun clearUserMessage() {
        _uiState.update { it.copy(userMessage = null) }
    }

    // Dialog toggles
    fun setAddProjectDialog(open: Boolean) = _uiState.update { it.copy(isAddProjectDialogOpen = open) }
    fun setAddInvoiceDialog(open: Boolean) = _uiState.update { it.copy(isAddInvoiceDialogOpen = open) }
    fun setAddPurchaseDialog(open: Boolean) = _uiState.update { it.copy(isAddPurchaseDialogOpen = open) }
    fun setAddExpenseDialog(open: Boolean) = _uiState.update { it.copy(isAddExpenseDialogOpen = open) }
    fun setAddMoneyInDialog(open: Boolean) = _uiState.update { it.copy(isAddMoneyInDialogOpen = open) }
    fun setAddMoneyOutDialog(open: Boolean) = _uiState.update { it.copy(isAddMoneyOutDialogOpen = open) }
    fun setTransferDialog(open: Boolean) = _uiState.update { it.copy(isTransferDialogOpen = open) }
    fun setNewCustomerDialog(open: Boolean) = _uiState.update { it.copy(isNewCustomerDialogOpen = open) }
    fun setNewVendorDialog(open: Boolean) = _uiState.update { it.copy(isNewVendorDialogOpen = open) }
    fun setNewAccountDialog(open: Boolean) = _uiState.update { it.copy(isNewAccountDialogOpen = open) }

    // Domain Actions
    fun createProject(code: String, name: String, customerId: String, customerName: String, contractValue: Double, budgetCost: Double, startDate: String, remarks: String) {
        viewModelScope.launch {
            repository.addProject(code, name, customerId, customerName, contractValue, budgetCost, startDate, remarks, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setAddProjectDialog(false)
            _uiState.update { it.copy(userMessage = "Project $code created successfully.") }
        }
    }

    fun createCustomer(code: String, name: String, phone: String, email: String) {
        viewModelScope.launch {
            repository.addCustomer(code, name, phone, email, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setNewCustomerDialog(false)
            _uiState.update { it.copy(userMessage = "Client $name added.") }
        }
    }

    fun createVendor(code: String, name: String, category: String, phone: String, email: String) {
        viewModelScope.launch {
            repository.addVendor(code, name, category, phone, email, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setNewVendorDialog(false)
            _uiState.update { it.copy(userMessage = "Vendor $name added.") }
        }
    }

    fun createAccount(type: AccountType, bankName: String, name: String, number: String, balance: Double) {
        viewModelScope.launch {
            repository.addAccount(type, bankName, name, number, balance, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setNewAccountDialog(false)
            _uiState.update { it.copy(userMessage = "Account $name opened.") }
        }
    }

    fun createInvoice(docRef: String, projectId: String, projectName: String, customerId: String, customerName: String, description: String, amount: Double) {
        viewModelScope.launch {
            repository.addClientInvoice(docRef, projectId, projectName, customerId, customerName, description, amount, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setAddInvoiceDialog(false)
            _uiState.update { it.copy(userMessage = "Client IPC $docRef submitted for approval.") }
        }
    }

    fun createPurchase(docRef: String, projectId: String, projectName: String, vendorId: String, vendorName: String, description: String, amount: Double) {
        viewModelScope.launch {
            repository.addPurchase(docRef, projectId, projectName, vendorId, vendorName, description, amount, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setAddPurchaseDialog(false)
            _uiState.update { it.copy(userMessage = "Purchase Bill $docRef submitted for approval.") }
        }
    }

    fun createExpense(docRef: String, projectId: String, projectName: String, accountId: String, accountName: String, expenseHeadId: String, expenseHeadName: String, description: String, amount: Double) {
        viewModelScope.launch {
            repository.addDirectExpense(docRef, projectId, projectName, accountId, accountName, expenseHeadId, expenseHeadName, description, amount, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setAddExpenseDialog(false)
            _uiState.update { it.copy(userMessage = "Site Expense $docRef recorded.") }
        }
    }

    fun recordMoneyIn(docRef: String, projectId: String, projectName: String, customerId: String, customerName: String, accountId: String, accountName: String, description: String, amount: Double) {
        viewModelScope.launch {
            repository.addMoneyIn(docRef, projectId, projectName, customerId, customerName, accountId, accountName, description, amount, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setAddMoneyInDialog(false)
            _uiState.update { it.copy(userMessage = "Received OMR $amount deposited to $accountName.") }
        }
    }

    fun recordMoneyOut(docRef: String, projectId: String, projectName: String, vendorId: String, vendorName: String, accountId: String, accountName: String, description: String, amount: Double) {
        viewModelScope.launch {
            repository.addMoneyOut(docRef, projectId, projectName, vendorId, vendorName, accountId, accountName, description, amount, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setAddMoneyOutDialog(false)
            _uiState.update { it.copy(userMessage = "Disbursed OMR $amount from $accountName.") }
        }
    }

    fun executeTransfer(docRef: String, fromAccId: String, fromAccName: String, toAccId: String, toAccName: String, amount: Double, remarks: String) {
        viewModelScope.launch {
            repository.executeTransfer(docRef, fromAccId, fromAccName, toAccId, toAccName, amount, remarks, _uiState.value.currentUserName, _uiState.value.currentUserRole.name)
            setTransferDialog(false)
            _uiState.update { it.copy(userMessage = "Transferred OMR $amount from $fromAccName to $toAccName.") }
        }
    }

    fun approveTransaction(tx: TransactionEntity) {
        viewModelScope.launch {
            repository.approveTransaction(tx, _uiState.value.currentUserName, _uiState.value.currentUserRole.displayName)
            _uiState.update { it.copy(userMessage = "Approved ${tx.type.label} ${tx.documentRef}.") }
        }
    }

    fun postTransaction(tx: TransactionEntity) {
        viewModelScope.launch {
            repository.postTransaction(tx, _uiState.value.currentUserName, _uiState.value.currentUserRole.displayName)
            _uiState.update { it.copy(userMessage = "Posted ${tx.type.label} ${tx.documentRef} to General Ledger.") }
        }
    }

    fun rejectTransaction(tx: TransactionEntity, reason: String) {
        viewModelScope.launch {
            repository.rejectTransaction(tx, reason, _uiState.value.currentUserName, _uiState.value.currentUserRole.displayName)
            _uiState.update { it.copy(userMessage = "Rejected ${tx.type.label} ${tx.documentRef}.") }
        }
    }

    fun reverseTransaction(tx: TransactionEntity, reason: String) {
        viewModelScope.launch {
            repository.reverseTransaction(tx, reason, _uiState.value.currentUserName, _uiState.value.currentUserRole.displayName)
            _uiState.update { it.copy(userMessage = "Reversed voucher ${tx.documentRef}.") }
        }
    }

    fun onLoginSuccess(user: UserProfile) {
        _uiState.update {
            it.copy(
                currentUserProfile = user,
                currentUserName = user.fullName,
                currentUserRole = user.toUserRole(),
                isAuthenticated = true,
                userMessage = "Welcome, ${user.fullName} (${user.roleName})"
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.update {
                it.copy(
                    currentUserProfile = null,
                    isAuthenticated = false,
                    userMessage = "Logged out successfully."
                )
            }
        }
    }

    fun toggleDarkMode(currentIsDark: Boolean) {
        _uiState.update {
            val nextMode = !currentIsDark
            it.copy(
                isDarkMode = nextMode,
                userMessage = if (nextMode) "Switched to Dark Theme" else "Switched to Light Theme"
            )
        }
    }

    fun setThemeMode(isDark: Boolean?) {
        _uiState.update {
            it.copy(
                isDarkMode = isDark,
                userMessage = when (isDark) {
                    true -> "Switched to Dark Theme"
                    false -> "Switched to Light Theme"
                    null -> "Theme following System Settings"
                }
            )
        }
    }
}

class CasViewModelFactory(
    private val repository: CasRepository,
    private val authRepository: AuthRepository
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(CasViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return CasViewModel(repository, authRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
