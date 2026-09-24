package com.artifysols.cas.data.remote

import com.artifysols.cas.data.remote.dto.ClientInvoiceLedgerDto
import com.artifysols.cas.data.remote.dto.CustomerDto
import com.artifysols.cas.data.remote.dto.MoneyInLedgerDto
import com.artifysols.cas.data.remote.dto.ProjectNameDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Reads the same tables the web app's Customer ledger (accountingService.ts#getCustomerLedger)
 * reads. All invoices/receipts are fetched once (not per customer) and grouped
 * client-side by [CustomerLedgerMath], since this is a small accounting
 * dataset and avoids N+1 network calls for the master list.
 */
class SupabaseCustomersDataSource(private val client: SupabaseClient) {

    suspend fun fetchAll(): CustomersRawData = coroutineScope {
        val customers = async {
            client.postgrest.from("customers")
                .select(
                    columns = Columns.list(
                        "id", "code", "name", "contact_person", "phone", "email", "vatin", "opening_balance",
                    )
                )
                .decodeList<CustomerDto>()
        }
        val invoices = async {
            client.postgrest.from("client_invoices")
                .select(
                    columns = Columns.list(
                        "id", "date", "customer_id", "project_id", "document_ref", "invoice_number",
                        "amount", "status", "remarks", "description",
                    )
                )
                .decodeList<ClientInvoiceLedgerDto>()
        }
        val receipts = async {
            client.postgrest.from("money_in")
                .select(
                    columns = Columns.list(
                        "id", "transaction_date", "customer_id", "project_id", "document_ref",
                        "amount", "status", "remarks",
                    )
                )
                .decodeList<MoneyInLedgerDto>()
        }
        val projects = async {
            client.postgrest.from("projects")
                .select(columns = Columns.list("id", "name"))
                .decodeList<ProjectNameDto>()
        }

        CustomersRawData(
            customers = customers.await(),
            invoices = invoices.await(),
            receipts = receipts.await(),
            projects = projects.await(),
        )
    }
}

data class CustomersRawData(
    val customers: List<CustomerDto>,
    val invoices: List<ClientInvoiceLedgerDto>,
    val receipts: List<MoneyInLedgerDto>,
    val projects: List<ProjectNameDto>,
)
