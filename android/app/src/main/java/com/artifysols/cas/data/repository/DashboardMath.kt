package com.artifysols.cas.data.repository

import com.artifysols.cas.data.remote.DashboardRawData
import com.artifysols.cas.domain.model.DashboardSummary
import kotlin.math.max

/**
 * Pure port of accountingService.ts#getDashboardStats from the web app.
 * Kept as a standalone function (no Supabase/coroutine dependency) so it can
 * be unit tested directly against hand-built fixtures, without a mocking
 * framework and without a network call.
 */
fun computeDashboardSummary(raw: DashboardRawData): DashboardSummary {
    val bankBalance = raw.bankAccounts.filter { it.status == "active" }.sumOf { it.currentBalance }
    val cashInHand = raw.cashAccounts.filter { it.status == "active" }.sumOf { it.currentBalance }
    val pettyCash = raw.pettyCashAccounts.filter { it.status == "active" }.sumOf { it.currentBalance }

    val totalInvoiced = raw.clientInvoices.filter { it.status != "reversed" }.sumOf { it.amount }
    val totalCollected = raw.moneyIn.filter { it.status != "reversed" }.sumOf { it.amount }
    val clientReceivables = max(0.0, totalInvoiced - totalCollected)

    val totalBilled = raw.purchases.filter { it.status != "reversed" }.sumOf { it.amount }
    val totalPaid = raw.moneyOut
        .filter { it.status != "reversed" && it.paymentFor == "purchase" }
        .sumOf { it.amount }
    val vendorPayables = max(0.0, totalBilled - totalPaid)

    return DashboardSummary(
        bankBalance = bankBalance,
        cashInHand = cashInHand,
        pettyCash = pettyCash,
        clientReceivables = clientReceivables,
        totalInvoiced = totalInvoiced,
        totalCollected = totalCollected,
        vendorPayables = vendorPayables,
        totalBilled = totalBilled,
        totalPaid = totalPaid,
    )
}
