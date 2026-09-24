package com.artifysols.cas.domain.model

data class Customer(
    val id: String,
    val code: String,
    val name: String,
    val contactPerson: String?,
    val phone: String?,
    val email: String?,
    val vatin: String?,
    val openingBalance: Double,
)

/** One row in the master Customers list: a customer plus its computed totals. */
data class CustomerSummary(
    val customer: Customer,
    val totalInvoiced: Double,
    val totalReceived: Double,
    val outstanding: Double,
)

enum class CustomerLedgerEntryType { INVOICE, RECEIPT }

/** One chronological row in a customer's statement of account. */
data class CustomerLedgerEntry(
    val id: String,
    val date: String,
    val type: CustomerLedgerEntryType,
    val projectName: String?,
    val documentRef: String?,
    val description: String,
    val invoiced: Double,
    val received: Double,
    /** Running outstanding balance immediately after this entry. */
    val outstanding: Double,
)

data class CustomerLedger(
    val customer: Customer,
    val entries: List<CustomerLedgerEntry>,
    /** Outstanding balance as of the latest entry (or the opening balance if there are none). */
    val outstanding: Double,
)
