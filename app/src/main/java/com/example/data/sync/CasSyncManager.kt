package com.example.data.sync

import com.example.data.local.CasDao
import com.example.data.model.*
import com.example.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CasSyncManager(
    private val dao: CasDao,
    private val supabaseClient: SupabaseClient
) {

    suspend fun syncAll(): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        if (!supabaseClient.isConfigured()) {
            return@withContext Pair(false, "Supabase credentials not configured.")
        }

        try {
            var syncedCount = 0

            // 1. Sync Customers
            val customersArray = supabaseClient.getTableJson("customers")
            if (customersArray != null) {
                for (i in 0 until customersArray.length()) {
                    val obj = customersArray.getJSONObject(i)
                    val id = obj.optString("id")
                    val code = obj.optString("code")
                    val name = obj.optString("name")
                    if (id.isNotEmpty() && name.isNotEmpty()) {
                        dao.insertCustomer(
                            CustomerEntity(
                                id = id,
                                code = code.ifEmpty { "CUST-$i" },
                                name = name,
                                contactPerson = obj.optString("contact_person"),
                                phone = obj.optString("phone"),
                                email = obj.optString("email"),
                                address = obj.optString("address"),
                                openingBalance = obj.optDouble("opening_balance", 0.0),
                                status = obj.optString("status", "active"),
                                remarks = obj.optString("remarks"),
                                createdAt = obj.optString("created_at")
                            )
                        )
                        syncedCount++
                    }
                }
            }

            // 2. Sync Vendors
            val vendorsArray = supabaseClient.getTableJson("vendors")
            if (vendorsArray != null) {
                for (i in 0 until vendorsArray.length()) {
                    val obj = vendorsArray.getJSONObject(i)
                    val id = obj.optString("id")
                    val name = obj.optString("name")
                    if (id.isNotEmpty() && name.isNotEmpty()) {
                        dao.insertVendor(
                            VendorEntity(
                                id = id,
                                code = obj.optString("code", "VEND-$i"),
                                name = name,
                                category = obj.optString("category", "General"),
                                contactPerson = obj.optString("contact_person"),
                                phone = obj.optString("phone"),
                                email = obj.optString("email"),
                                openingBalance = obj.optDouble("opening_balance", 0.0),
                                status = obj.optString("status", "active"),
                                remarks = obj.optString("remarks"),
                                createdAt = obj.optString("created_at")
                            )
                        )
                        syncedCount++
                    }
                }
            }

            // 3. Sync Projects
            val projectsArray = supabaseClient.getTableJson("projects")
            if (projectsArray != null) {
                for (i in 0 until projectsArray.length()) {
                    val obj = projectsArray.getJSONObject(i)
                    val id = obj.optString("id")
                    val name = obj.optString("name")
                    if (id.isNotEmpty() && name.isNotEmpty()) {
                        val custId = obj.optString("customer_id")
                        dao.insertProject(
                            ProjectEntity(
                                id = id,
                                code = obj.optString("code", "PRJ-$i"),
                                name = name,
                                customerId = custId,
                                customerName = obj.optString("customer_name", "Enterprise Client"),
                                contractValue = obj.optDouble("contract_value", 0.0),
                                budgetCost = obj.optDouble("budget_cost", 0.0),
                                startDate = obj.optString("start_date", "2026-01-01"),
                                endDate = obj.optString("end_date", ""),
                                status = obj.optString("status", "active"),
                                remarks = obj.optString("remarks"),
                                createdAt = obj.optString("created_at")
                            )
                        )
                        syncedCount++
                    }
                }
            }

            // 4. Sync Bank Accounts
            val bankAccountsArray = supabaseClient.getTableJson("bank_accounts")
            if (bankAccountsArray != null) {
                for (i in 0 until bankAccountsArray.length()) {
                    val obj = bankAccountsArray.getJSONObject(i)
                    val id = obj.optString("id")
                    val name = obj.optString("account_name")
                    if (id.isNotEmpty() && name.isNotEmpty()) {
                        dao.insertAccount(
                            AccountEntity(
                                id = id,
                                accountType = AccountType.BANK,
                                bankName = obj.optString("bank_name", "Corporate Bank"),
                                accountName = name,
                                accountNumber = obj.optString("account_number"),
                                currency = obj.optString("currency", "OMR"),
                                openingBalance = obj.optDouble("opening_balance", 0.0),
                                currentBalance = obj.optDouble("current_balance", 0.0),
                                status = obj.optString("status", "active"),
                                remarks = obj.optString("remarks"),
                                createdAt = obj.optString("created_at")
                            )
                        )
                        syncedCount++
                    }
                }
            }

            // 5. Sync Client Invoices
            val invoicesArray = supabaseClient.getTableJson("client_invoices")
            if (invoicesArray != null) {
                for (i in 0 until invoicesArray.length()) {
                    val obj = invoicesArray.getJSONObject(i)
                    val id = obj.optString("id")
                    val ref = obj.optString("document_ref", obj.optString("invoice_number", "INV-$i"))
                    if (id.isNotEmpty()) {
                        dao.insertTransaction(
                            TransactionEntity(
                                id = id,
                                type = TransactionType.CLIENT_INVOICE,
                                date = obj.optString("date", "2026-01-01"),
                                documentRef = ref,
                                projectId = obj.optString("project_id"),
                                projectName = obj.optString("project_name", "Construction Project"),
                                customerId = obj.optString("customer_id"),
                                customerName = obj.optString("customer_name", "Client"),
                                description = obj.optString("description", "Work Certified IPC"),
                                amount = obj.optDouble("amount", 0.0),
                                receivedOrPaidAmount = obj.optDouble("received_amount", 0.0),
                                outstandingAmount = obj.optDouble("outstanding_amount", 0.0),
                                status = TransactionStatus.POSTED,
                                remarks = obj.optString("remarks"),
                                createdAt = obj.optString("created_at")
                            )
                        )
                        syncedCount++
                    }
                }
            }

            // 6. Sync Purchases
            val purchasesArray = supabaseClient.getTableJson("purchases")
            if (purchasesArray != null) {
                for (i in 0 until purchasesArray.length()) {
                    val obj = purchasesArray.getJSONObject(i)
                    val id = obj.optString("id")
                    val ref = obj.optString("document_ref", obj.optString("purchase_invoice_number", "PO-$i"))
                    if (id.isNotEmpty()) {
                        dao.insertTransaction(
                            TransactionEntity(
                                id = id,
                                type = TransactionType.PURCHASE,
                                date = obj.optString("date", "2026-01-01"),
                                documentRef = ref,
                                projectId = obj.optString("project_id"),
                                projectName = obj.optString("project_name", "Construction Project"),
                                vendorId = obj.optString("vendor_id"),
                                vendorName = obj.optString("vendor_name", "Vendor"),
                                description = obj.optString("description", "Material Supply"),
                                amount = obj.optDouble("amount", 0.0),
                                receivedOrPaidAmount = obj.optDouble("paid_amount", 0.0),
                                outstandingAmount = obj.optDouble("outstanding_amount", 0.0),
                                status = TransactionStatus.POSTED,
                                remarks = obj.optString("remarks"),
                                createdAt = obj.optString("created_at")
                            )
                        )
                        syncedCount++
                    }
                }
            }

            val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
            Pair(true, "Synchronized $syncedCount records with live CAS Supabase database at $timestamp.")
        } catch (e: Exception) {
            Pair(false, "Sync failed: ${e.localizedMessage ?: e.message}")
        }
    }

    suspend fun pushProject(project: ProjectEntity) {
        if (!supabaseClient.isConfigured()) return
        val json = JSONObject().apply {
            put("code", project.code)
            put("name", project.name)
            put("contract_value", project.contractValue)
            put("start_date", project.startDate)
            put("status", project.status)
            put("remarks", project.remarks)
        }
        supabaseClient.insertRecord("projects", json)
    }

    suspend fun pushInvoice(tx: TransactionEntity) {
        if (!supabaseClient.isConfigured()) return
        val json = JSONObject().apply {
            put("invoice_type", "IPC")
            put("invoice_number", tx.documentRef)
            put("date", tx.date)
            put("description", tx.description)
            put("amount", tx.amount)
            put("document_ref", tx.documentRef)
            put("received_amount", tx.receivedOrPaidAmount)
            put("outstanding_amount", tx.outstandingAmount)
            put("status", "posted")
        }
        supabaseClient.insertRecord("client_invoices", json)
    }

    suspend fun pushPurchase(tx: TransactionEntity) {
        if (!supabaseClient.isConfigured()) return
        val json = JSONObject().apply {
            put("purchase_invoice_number", tx.documentRef)
            put("date", tx.date)
            put("description", tx.description)
            put("amount", tx.amount)
            put("document_ref", tx.documentRef)
            put("paid_amount", tx.receivedOrPaidAmount)
            put("outstanding_amount", tx.outstandingAmount)
            put("status", "posted")
        }
        supabaseClient.insertRecord("purchases", json)
    }

    suspend fun pushMoneyIn(tx: TransactionEntity) {
        if (!supabaseClient.isConfigured()) return
        val json = JSONObject().apply {
            put("transaction_date", tx.date)
            put("received_from", tx.customerName)
            put("against", "invoice")
            put("amount", tx.amount)
            put("received_into", "bank")
            put("document_ref", tx.documentRef)
            put("status", "posted")
        }
        supabaseClient.insertRecord("money_in", json)
    }

    suspend fun pushMoneyOut(tx: TransactionEntity) {
        if (!supabaseClient.isConfigured()) return
        val json = JSONObject().apply {
            put("transaction_date", tx.date)
            put("paid_to", tx.vendorName)
            put("payment_for", "purchase")
            put("amount", tx.amount)
            put("paid_from", "bank")
            put("document_ref", tx.documentRef)
            put("status", "posted")
        }
        supabaseClient.insertRecord("money_out", json)
    }
}
