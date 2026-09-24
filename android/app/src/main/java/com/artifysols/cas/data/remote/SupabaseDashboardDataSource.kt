package com.artifysols.cas.data.remote

import com.artifysols.cas.data.remote.dto.AccountBalanceDto
import com.artifysols.cas.data.remote.dto.InvoiceAmountDto
import com.artifysols.cas.data.remote.dto.MoneyInAmountDto
import com.artifysols.cas.data.remote.dto.MoneyOutAmountDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Reads the same tables, same columns, under the same RLS policies the web
 * dashboard reads — this is the actual backend, not a mocked stand-in. All
 * six queries run concurrently since none depends on another.
 */
class SupabaseDashboardDataSource(private val client: SupabaseClient) {

    suspend fun fetchRaw(): DashboardRawData = coroutineScope {
        val bankAccounts = async {
            client.postgrest.from("bank_accounts")
                .select(columns = Columns.list("current_balance", "status"))
                .decodeList<AccountBalanceDto>()
        }
        val cashAccounts = async {
            client.postgrest.from("cash_accounts")
                .select(columns = Columns.list("current_balance", "status"))
                .decodeList<AccountBalanceDto>()
        }
        val pettyCashAccounts = async {
            client.postgrest.from("petty_cash_accounts")
                .select(columns = Columns.list("current_balance", "status"))
                .decodeList<AccountBalanceDto>()
        }
        val clientInvoices = async {
            client.postgrest.from("client_invoices")
                .select(columns = Columns.list("amount", "status"))
                .decodeList<InvoiceAmountDto>()
        }
        val purchases = async {
            client.postgrest.from("purchases")
                .select(columns = Columns.list("amount", "status"))
                .decodeList<InvoiceAmountDto>()
        }
        val moneyIn = async {
            client.postgrest.from("money_in")
                .select(columns = Columns.list("amount", "status"))
                .decodeList<MoneyInAmountDto>()
        }
        val moneyOut = async {
            client.postgrest.from("money_out")
                .select(columns = Columns.list("amount", "status", "payment_for"))
                .decodeList<MoneyOutAmountDto>()
        }

        DashboardRawData(
            bankAccounts = bankAccounts.await(),
            cashAccounts = cashAccounts.await(),
            pettyCashAccounts = pettyCashAccounts.await(),
            clientInvoices = clientInvoices.await(),
            purchases = purchases.await(),
            moneyIn = moneyIn.await(),
            moneyOut = moneyOut.await(),
        )
    }
}

data class DashboardRawData(
    val bankAccounts: List<AccountBalanceDto>,
    val cashAccounts: List<AccountBalanceDto>,
    val pettyCashAccounts: List<AccountBalanceDto>,
    val clientInvoices: List<InvoiceAmountDto>,
    val purchases: List<InvoiceAmountDto>,
    val moneyIn: List<MoneyInAmountDto>,
    val moneyOut: List<MoneyOutAmountDto>,
)
