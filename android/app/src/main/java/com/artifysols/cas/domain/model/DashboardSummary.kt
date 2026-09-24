package com.artifysols.cas.domain.model

/**
 * Same three headline figures as the web dashboard's top stat cards, using
 * identical math (see accountingService.ts#getDashboardStats on the web
 * side): liquid funds is the sum of active treasury account balances;
 * receivables/payables are outstanding invoice/bill totals net of what's
 * already been collected/paid, floored at zero.
 */
data class DashboardSummary(
    val bankBalance: Double,
    val cashInHand: Double,
    val pettyCash: Double,
    val clientReceivables: Double,
    val totalInvoiced: Double,
    val totalCollected: Double,
    val vendorPayables: Double,
    val totalBilled: Double,
    val totalPaid: Double,
) {
    val liquidFunds: Double get() = bankBalance + cashInHand + pettyCash
}
