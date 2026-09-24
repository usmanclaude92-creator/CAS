package com.artifysols.cas.data.repository

import com.artifysols.cas.data.remote.CustomersRawData
import com.artifysols.cas.data.remote.dto.ClientInvoiceLedgerDto
import com.artifysols.cas.data.remote.dto.CustomerDto
import com.artifysols.cas.data.remote.dto.MoneyInLedgerDto
import com.artifysols.cas.domain.model.Customer
import com.artifysols.cas.domain.model.CustomerLedger
import com.artifysols.cas.domain.model.CustomerLedgerEntry
import com.artifysols.cas.domain.model.CustomerLedgerEntryType
import com.artifysols.cas.domain.model.CustomerSummary

fun CustomerDto.toDomain(): Customer = Customer(
    id = id,
    code = code,
    name = name,
    contactPerson = contactPerson,
    phone = phone,
    email = email,
    vatin = vatin,
    openingBalance = openingBalance,
)

private data class RawLedgerItem(
    val date: String,
    val projectName: String?,
    val documentRef: String?,
    val invoiceNumber: String?,
    val invoiceAmount: Double,
    val receiptAmount: Double,
    val remarks: String?,
    val sourceId: String,
)

/**
 * Pure port of accountingService.ts#getCustomerLedger from the web app:
 * invoices raise the running balance, receipts lower it, processed in
 * chronological order. Kept dependency-free so it's unit testable directly
 * against fixtures, without a network call.
 */
private fun buildLedgerEntries(
    invoices: List<ClientInvoiceLedgerDto>,
    receipts: List<MoneyInLedgerDto>,
    projectNamesById: Map<String, String>,
    customerId: String?,
): List<CustomerLedgerEntry> {
    val rawItems = mutableListOf<RawLedgerItem>()

    invoices
        .filter { customerId == null || it.customerId == customerId }
        .forEach { invoice ->
            rawItems += RawLedgerItem(
                date = invoice.date,
                projectName = invoice.projectId?.let { projectNamesById[it] },
                documentRef = invoice.documentRef,
                invoiceNumber = invoice.invoiceNumber,
                invoiceAmount = if (invoice.status == "reversed") 0.0 else invoice.amount,
                receiptAmount = 0.0,
                remarks = invoice.remarks ?: invoice.description,
                sourceId = invoice.id,
            )
        }

    receipts
        .filter { it.customerId != null && (customerId == null || it.customerId == customerId) }
        .forEach { receipt ->
            rawItems += RawLedgerItem(
                date = receipt.transactionDate,
                projectName = receipt.projectId?.let { projectNamesById[it] },
                documentRef = receipt.documentRef,
                invoiceNumber = null,
                invoiceAmount = 0.0,
                receiptAmount = if (receipt.status == "reversed") 0.0 else receipt.amount,
                remarks = receipt.remarks,
                sourceId = receipt.id,
            )
        }

    rawItems.sortBy { it.date }

    var runningOutstanding = 0.0
    return rawItems.map { item ->
        runningOutstanding += item.invoiceAmount
        runningOutstanding -= item.receiptAmount

        CustomerLedgerEntry(
            id = item.sourceId,
            date = item.date,
            type = if (item.invoiceAmount > 0) CustomerLedgerEntryType.INVOICE else CustomerLedgerEntryType.RECEIPT,
            projectName = item.projectName,
            documentRef = item.documentRef,
            description = item.remarks ?: item.invoiceNumber?.let { "Invoice #$it" } ?: "Payment Received",
            invoiced = item.invoiceAmount,
            received = item.receiptAmount,
            outstanding = runningOutstanding,
        )
    }
}

fun computeCustomerLedger(raw: CustomersRawData, customer: Customer): CustomerLedger {
    val projectNamesById = raw.projects.associate { it.id to it.name }
    val entries = buildLedgerEntries(raw.invoices, raw.receipts, projectNamesById, customer.id)
    val outstanding = entries.lastOrNull()?.outstanding ?: customer.openingBalance
    return CustomerLedger(customer = customer, entries = entries, outstanding = outstanding)
}

fun computeCustomerSummaries(raw: CustomersRawData): List<CustomerSummary> {
    val projectNamesById = raw.projects.associate { it.id to it.name }
    return raw.customers.map { dto ->
        val customer = dto.toDomain()
        val entries = buildLedgerEntries(raw.invoices, raw.receipts, projectNamesById, customer.id)
        CustomerSummary(
            customer = customer,
            totalInvoiced = entries.sumOf { it.invoiced },
            totalReceived = entries.sumOf { it.received },
            outstanding = entries.lastOrNull()?.outstanding ?: customer.openingBalance,
        )
    }
}
