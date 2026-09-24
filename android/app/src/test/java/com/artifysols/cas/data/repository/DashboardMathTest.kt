package com.artifysols.cas.data.repository

import com.artifysols.cas.data.remote.DashboardRawData
import com.artifysols.cas.data.remote.dto.AccountBalanceDto
import com.artifysols.cas.data.remote.dto.InvoiceAmountDto
import com.artifysols.cas.data.remote.dto.MoneyInAmountDto
import com.artifysols.cas.data.remote.dto.MoneyOutAmountDto
import org.junit.Assert.assertEquals
import org.junit.Test

class DashboardMathTest {

    @Test
    fun `liquid funds sums only active accounts`() {
        val raw = emptyRaw().copy(
            bankAccounts = listOf(
                AccountBalanceDto(currentBalance = 1000.0, status = "active"),
                AccountBalanceDto(currentBalance = 500.0, status = "inactive"),
            ),
            cashAccounts = listOf(AccountBalanceDto(currentBalance = 200.0, status = "active")),
            pettyCashAccounts = listOf(AccountBalanceDto(currentBalance = 50.0, status = "active")),
        )

        val summary = computeDashboardSummary(raw)

        assertEquals(1000.0, summary.bankBalance, 0.001)
        assertEquals(1250.0, summary.liquidFunds, 0.001)
    }

    @Test
    fun `client receivables excludes reversed invoices and floors at zero`() {
        val raw = emptyRaw().copy(
            clientInvoices = listOf(
                InvoiceAmountDto(amount = 1000.0, status = "posted"),
                InvoiceAmountDto(amount = 5000.0, status = "reversed"),
            ),
            moneyIn = listOf(MoneyInAmountDto(amount = 1500.0, status = "posted")),
        )

        val summary = computeDashboardSummary(raw)

        // 1000 invoiced (reversed 5000 excluded) - 1500 collected -> would be
        // negative, must floor at 0, matching accountingService.ts's Math.max(0, ...).
        assertEquals(0.0, summary.clientReceivables, 0.001)
        assertEquals(1000.0, summary.totalInvoiced, 0.001)
    }

    @Test
    fun `vendor payables only counts money_out rows paying a purchase`() {
        val raw = emptyRaw().copy(
            purchases = listOf(InvoiceAmountDto(amount = 2000.0, status = "posted")),
            moneyOut = listOf(
                MoneyOutAmountDto(amount = 500.0, status = "posted", paymentFor = "purchase"),
                MoneyOutAmountDto(amount = 300.0, status = "posted", paymentFor = "expense"),
            ),
        )

        val summary = computeDashboardSummary(raw)

        assertEquals(1500.0, summary.vendorPayables, 0.001) // 2000 - 500, expense payment ignored
    }

    private fun emptyRaw() = DashboardRawData(
        bankAccounts = emptyList(),
        cashAccounts = emptyList(),
        pettyCashAccounts = emptyList(),
        clientInvoices = emptyList(),
        purchases = emptyList(),
        moneyIn = emptyList(),
        moneyOut = emptyList(),
    )
}
