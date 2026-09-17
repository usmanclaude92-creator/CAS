package com.example.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.data.model.AccountType
import com.example.theme.ConstructionBlue
import com.example.theme.Slate400
import com.example.ui.viewmodel.CasViewModel

@Composable
fun CasDialogsContainer(viewModel: CasViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    // Add Project Dialog
    if (uiState.isAddProjectDialogOpen) {
        var code by remember { mutableStateOf("PRJ-${(100..999).random()}") }
        var name by remember { mutableStateOf("") }
        var selectedCustomer by remember { mutableStateOf(uiState.customers.firstOrNull()) }
        var contractValue by remember { mutableStateOf("") }
        var budgetCost by remember { mutableStateOf("") }
        var remarks by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setAddProjectDialog(false) },
            title = { Text("Create New Project") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Project Code") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Project Name") }, modifier = Modifier.fillMaxWidth())
                    Text("Select Client:", color = Slate400)
                    uiState.customers.forEach { cust ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedCustomer?.id == cust.id, onClick = { selectedCustomer = cust })
                            Text(cust.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = contractValue, onValueChange = { contractValue = it }, label = { Text("Contract Value (OMR)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = budgetCost, onValueChange = { budgetCost = it }, label = { Text("Budgeted Cost (OMR)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = remarks, onValueChange = { remarks = it }, label = { Text("Scope & Location Remarks") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isNotEmpty() && selectedCustomer != null) {
                            viewModel.createProject(
                                code = code,
                                name = name,
                                customerId = selectedCustomer!!.id,
                                customerName = selectedCustomer!!.name,
                                contractValue = contractValue.toDoubleOrNull() ?: 0.0,
                                budgetCost = budgetCost.toDoubleOrNull() ?: 0.0,
                                startDate = "2026-03-01",
                                remarks = remarks
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Create Project") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddProjectDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Add Client Invoice Dialog
    if (uiState.isAddInvoiceDialogOpen) {
        var docRef by remember { mutableStateOf("IPC-${(100..999).random()}") }
        var selectedProject by remember { mutableStateOf(uiState.projects.firstOrNull()) }
        var description by remember { mutableStateOf("") }
        var amount by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setAddInvoiceDialog(false) },
            title = { Text("Submit Client Invoice (IPC)") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(value = docRef, onValueChange = { docRef = it }, label = { Text("IPC Reference No") }, modifier = Modifier.fillMaxWidth())
                    Text("Select Project:", color = Slate400)
                    uiState.projects.forEach { prj ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedProject?.id == prj.id, onClick = { selectedProject = prj })
                            Text("${prj.code} - ${prj.name}", modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Work Scope / Milestone Description") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Invoiced Amount (OMR)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        selectedProject?.let { prj ->
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (amt > 0) {
                                viewModel.createInvoice(docRef, prj.id, prj.name, prj.customerId, prj.customerName, description, amt)
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Submit IPC") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddInvoiceDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Add Purchase / Bill Dialog
    if (uiState.isAddPurchaseDialogOpen) {
        var docRef by remember { mutableStateOf("PO-${(1000..9999).random()}") }
        var selectedProject by remember { mutableStateOf(uiState.projects.firstOrNull()) }
        var selectedVendor by remember { mutableStateOf(uiState.vendors.firstOrNull()) }
        var description by remember { mutableStateOf("") }
        var amount by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setAddPurchaseDialog(false) },
            title = { Text("Submit Vendor Purchase Bill") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(value = docRef, onValueChange = { docRef = it }, label = { Text("PO / Bill Number") }, modifier = Modifier.fillMaxWidth())
                    Text("Assign to Project:", color = Slate400)
                    uiState.projects.forEach { prj ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedProject?.id == prj.id, onClick = { selectedProject = prj })
                            Text(prj.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("Supplier / Vendor:", color = Slate400)
                    uiState.vendors.forEach { vend ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedVendor?.id == vend.id, onClick = { selectedVendor = vend })
                            Text(vend.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Materials / Service Description") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Bill Amount (OMR)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (selectedProject != null && selectedVendor != null) {
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (amt > 0) {
                                viewModel.createPurchase(docRef, selectedProject!!.id, selectedProject!!.name, selectedVendor!!.id, selectedVendor!!.name, description, amt)
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Submit Purchase") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddPurchaseDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Add Direct Expense Dialog
    if (uiState.isAddExpenseDialogOpen) {
        var docRef by remember { mutableStateOf("EXP-${(100..999).random()}") }
        var selectedProject by remember { mutableStateOf(uiState.projects.firstOrNull()) }
        var selectedAccount by remember { mutableStateOf(uiState.accounts.firstOrNull()) }
        var selectedHead by remember { mutableStateOf(uiState.expenseHeads.firstOrNull()) }
        var description by remember { mutableStateOf("") }
        var amount by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setAddExpenseDialog(false) },
            title = { Text("Record Site Operating Expense") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(value = docRef, onValueChange = { docRef = it }, label = { Text("Voucher Reference") }, modifier = Modifier.fillMaxWidth())
                    Text("Project Cost Center:", color = Slate400)
                    uiState.projects.forEach { prj ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedProject?.id == prj.id, onClick = { selectedProject = prj })
                            Text(prj.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("Disburse from Account:", color = Slate400)
                    uiState.accounts.forEach { acc ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedAccount?.id == acc.id, onClick = { selectedAccount = acc })
                            Text(acc.accountName, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("Expense Head:", color = Slate400)
                    uiState.expenseHeads.take(4).forEach { head ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedHead?.id == head.id, onClick = { selectedHead = head })
                            Text(head.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Particulars & Notes") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount (OMR)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (selectedProject != null && selectedAccount != null && selectedHead != null) {
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (amt > 0) {
                                viewModel.createExpense(docRef, selectedProject!!.id, selectedProject!!.name, selectedAccount!!.id, selectedAccount!!.accountName, selectedHead!!.id, selectedHead!!.name, description, amt)
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Record Expense") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddExpenseDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Money In Dialog (Receipt from Customer)
    if (uiState.isAddMoneyInDialogOpen) {
        var docRef by remember { mutableStateOf("RCT-${(1000..9999).random()}") }
        var selectedProject by remember { mutableStateOf(uiState.projects.firstOrNull()) }
        var selectedAccount by remember { mutableStateOf(uiState.accounts.firstOrNull()) }
        var description by remember { mutableStateOf("Client milestone collection") }
        var amount by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setAddMoneyInDialog(false) },
            title = { Text("Record Client Receipt (Money In)") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = docRef, onValueChange = { docRef = it }, label = { Text("Receipt Document No") }, modifier = Modifier.fillMaxWidth())
                    Text("Applied to Project:", color = Slate400)
                    uiState.projects.forEach { prj ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedProject?.id == prj.id, onClick = { selectedProject = prj })
                            Text("${prj.code} - ${prj.name}", modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("Deposit into Account:", color = Slate400)
                    uiState.accounts.forEach { acc ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedAccount?.id == acc.id, onClick = { selectedAccount = acc })
                            Text(acc.accountName, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Payment Ref / Cheque No") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Receipt Amount (OMR)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (selectedProject != null && selectedAccount != null) {
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (amt > 0) {
                                viewModel.recordMoneyIn(docRef, selectedProject!!.id, selectedProject!!.name, selectedProject!!.customerId, selectedProject!!.customerName, selectedAccount!!.id, selectedAccount!!.accountName, description, amt)
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Confirm Deposit") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddMoneyInDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Money Out Dialog (Payment to Vendor)
    if (uiState.isAddMoneyOutDialogOpen) {
        var docRef by remember { mutableStateOf("PMT-${(1000..9999).random()}") }
        var selectedProject by remember { mutableStateOf(uiState.projects.firstOrNull()) }
        var selectedVendor by remember { mutableStateOf(uiState.vendors.firstOrNull()) }
        var selectedAccount by remember { mutableStateOf(uiState.accounts.firstOrNull()) }
        var description by remember { mutableStateOf("Payment against supplier invoice") }
        var amount by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setAddMoneyOutDialog(false) },
            title = { Text("Record Vendor Payment (Money Out)") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = docRef, onValueChange = { docRef = it }, label = { Text("Payment Voucher No") }, modifier = Modifier.fillMaxWidth())
                    Text("Charged to Project:", color = Slate400)
                    uiState.projects.forEach { prj ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedProject?.id == prj.id, onClick = { selectedProject = prj })
                            Text(prj.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("Pay to Supplier:", color = Slate400)
                    uiState.vendors.forEach { vend ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedVendor?.id == vend.id, onClick = { selectedVendor = vend })
                            Text(vend.name, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("Disburse from Account:", color = Slate400)
                    uiState.accounts.forEach { acc ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = selectedAccount?.id == acc.id, onClick = { selectedAccount = acc })
                            Text(acc.accountName, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Bank Wire / Cheque Reference") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Payment Amount (OMR)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (selectedProject != null && selectedVendor != null && selectedAccount != null) {
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (amt > 0) {
                                viewModel.recordMoneyOut(docRef, selectedProject!!.id, selectedProject!!.name, selectedVendor!!.id, selectedVendor!!.name, selectedAccount!!.id, selectedAccount!!.accountName, description, amt)
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Confirm Disbursement") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddMoneyOutDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Inter-account Transfer Dialog
    if (uiState.isTransferDialogOpen) {
        var docRef by remember { mutableStateOf("TRF-${(100..999).random()}") }
        var fromAccount by remember { mutableStateOf(uiState.accounts.firstOrNull()) }
        var toAccount by remember { mutableStateOf(uiState.accounts.getOrNull(1)) }
        var amount by remember { mutableStateOf("") }
        var remarks by remember { mutableStateOf("Replenishment of site petty cash safe") }

        AlertDialog(
            onDismissRequest = { viewModel.setTransferDialog(false) },
            title = { Text("Inter-Account Treasury Transfer") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = docRef, onValueChange = { docRef = it }, label = { Text("Transfer Voucher No") }, modifier = Modifier.fillMaxWidth())
                    Text("From Source Account:", color = Slate400)
                    uiState.accounts.forEach { acc ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = fromAccount?.id == acc.id, onClick = { fromAccount = acc })
                            Text(acc.accountName, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    Text("To Destination Account:", color = Slate400)
                    uiState.accounts.forEach { acc ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            RadioButton(selected = toAccount?.id == acc.id, onClick = { toAccount = acc })
                            Text(acc.accountName, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Transfer Amount (OMR)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = remarks, onValueChange = { remarks = it }, label = { Text("Transfer Reason") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (fromAccount != null && toAccount != null && fromAccount?.id != toAccount?.id) {
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (amt > 0) {
                                viewModel.executeTransfer(docRef, fromAccount!!.id, fromAccount!!.accountName, toAccount!!.id, toAccount!!.accountName, amt, remarks)
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) { Text("Execute Transfer") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setTransferDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // New Customer Dialog
    if (uiState.isNewCustomerDialogOpen) {
        var code by remember { mutableStateOf("CUST-00${(10..99).random()}") }
        var name by remember { mutableStateOf("") }
        var phone by remember { mutableStateOf("") }
        var email by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setNewCustomerDialog(false) },
            title = { Text("Add Client / Employer") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Customer Code") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Company Name") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone Number") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email Address") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isNotEmpty()) {
                            viewModel.createCustomer(code, name, phone, email)
                        }
                    }
                ) { Text("Save Client") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setNewCustomerDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // New Vendor Dialog
    if (uiState.isNewVendorDialogOpen) {
        var code by remember { mutableStateOf("VEND-00${(10..99).random()}") }
        var name by remember { mutableStateOf("") }
        var category by remember { mutableStateOf("Subcontractor") }
        var phone by remember { mutableStateOf("") }
        var email by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setNewVendorDialog(false) },
            title = { Text("Add Vendor / Subcontractor") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Vendor Code") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Supplier Name") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Trade Category") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isNotEmpty()) {
                            viewModel.createVendor(code, name, category, phone, email)
                        }
                    }
                ) { Text("Save Vendor") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setNewVendorDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // New Account Dialog
    if (uiState.isNewAccountDialogOpen) {
        var bankName by remember { mutableStateOf("") }
        var accountName by remember { mutableStateOf("") }
        var accountNumber by remember { mutableStateOf("") }
        var openingBalance by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { viewModel.setNewAccountDialog(false) },
            title = { Text("Open Treasury Account") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = bankName, onValueChange = { bankName = it }, label = { Text("Bank / Vault Institution") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = accountName, onValueChange = { accountName = it }, label = { Text("Account Title") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = accountNumber, onValueChange = { accountNumber = it }, label = { Text("Account Number") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = openingBalance, onValueChange = { openingBalance = it }, label = { Text("Opening Balance (OMR)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (accountName.isNotEmpty()) {
                            viewModel.createAccount(AccountType.BANK, bankName, accountName, accountNumber, openingBalance.toDoubleOrNull() ?: 0.0)
                        }
                    }
                ) { Text("Open Account") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setNewAccountDialog(false) }) { Text("Cancel") }
            }
        )
    }

    // Supabase Cloud Configuration Dialog
    if (uiState.isSupabaseDialogOpen) {
        var urlInput by remember { mutableStateOf(uiState.supabaseUrl) }
        var keyInput by remember { mutableStateOf(uiState.supabaseAnonKey) }
        var testResult by remember { mutableStateOf<String?>(null) }
        var isTesting by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { viewModel.setSupabaseDialog(false) },
            title = {
                Text(
                    text = "CAS Supabase Cloud Database",
                    style = MaterialTheme.typography.titleMedium
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Connect directly to the PostgreSQL database backing the Construction Accounting System (CAS) with real-time cloud synchronization.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate400
                    )

                    OutlinedTextField(
                        value = urlInput,
                        onValueChange = { urlInput = it },
                        label = { Text("Supabase Project URL") },
                        placeholder = { Text("https://your-project.supabase.co") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = keyInput,
                        onValueChange = { keyInput = it },
                        label = { Text("Supabase Anon Public API Key") },
                        placeholder = { Text("eyJhbGciOi...") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                isTesting = true
                                testResult = "Pinging Supabase server..."
                                viewModel.saveSupabaseConfig(urlInput, keyInput)
                                viewModel.testSupabaseConnection { success, message ->
                                    isTesting = false
                                    testResult = if (success) "✓ $message" else "✗ $message"
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(if (isTesting) "Testing..." else "Test Connection")
                        }

                        if (uiState.isSupabaseConfigured) {
                            Button(
                                onClick = {
                                    viewModel.syncDatabase()
                                },
                                enabled = !uiState.isSyncing,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                            ) {
                                Text(if (uiState.isSyncing) "Syncing..." else "Sync Now")
                            }
                        }
                    }

                    testResult?.let { result ->
                        Text(
                            text = result,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (result.startsWith("✓")) com.example.theme.EmeraldSuccess else com.example.theme.RoseError
                        )
                    }

                    Text(
                        text = "Status: ${uiState.syncStatusMessage}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Slate400
                    )

                    if (uiState.isSupabaseConfigured) {
                        TextButton(
                            onClick = {
                                viewModel.disconnectSupabase()
                                testResult = "Disconnected. Running in local mode."
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Disconnect Supabase (Switch to Local Mode)", color = com.example.theme.RoseError)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.saveSupabaseConfig(urlInput, keyInput)
                        viewModel.setSupabaseDialog(false)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                ) {
                    Text("Save & Close")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setSupabaseDialog(false) }) {
                    Text("Close")
                }
            }
        )
    }
}
