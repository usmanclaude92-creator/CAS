package com.artifysols.cas.data.repository

import com.artifysols.cas.data.remote.CustomersRawData
import com.artifysols.cas.data.remote.dto.ClientInvoiceLedgerDto
import com.artifysols.cas.data.remote.dto.CustomerDto
import com.artifysols.cas.data.remote.dto.MoneyInLedgerDto
import com.artifysols.cas.data.remote.dto.ProjectNameDto
import com.artifysols.cas.domain.model.CustomerLedgerEntryType
import org.junit.Assert.assertEquals
import org.junit.Test

class CustomerLedgerMathTest {

    private fun customer(id: String = "cust-1", openingBalance: Double = 0.0) = CustomerDto(
        id = id,
        code = "C-001",
        name = "Test Customer",
        contactPerson = null,
        phone = null,
        email = null,
        vatin = null,
        openingBalance = openingBalance,
    )

    @Test
    fun `running outstanding rises with invoices and falls with receipts in date order`() {
        val raw = CustomersRawData(
            customers = listOf(customer()),
            invoices = listOf(
                ClientInvoiceLedgerDto(
                    id = "inv-1", date = "2026-01-05", customerId = "cust-1",
                    amount = 1000.0, status = "posted",
                ),
            ),
            receipts = listOf(
                MoneyInLedgerDto(
                    id = "rcpt-1", transactionDate = "2026-01-10", customerId = "cust-1",
                    amount = 400.0, status = "posted",
                ),
            ),
            projects = emptyList(),
        )

        val ledger = computeCustomerLedger(raw, customer().toDomain())

        assertEquals(2, ledger.entries.size)
        assertEquals(CustomerLedgerEntryType.INVOICE, ledger.entries[0].type)
        assertEquals(1000.0, ledger.entries[0].outstanding, 0.001)
        assertEquals(CustomerLedgerEntryType.RECEIPT, ledger.entries[1].type)
        assertEquals(600.0, ledger.entries[1].outstanding, 0.001)
        assertEquals(600.0, ledger.outstanding, 0.001)
    }

    @Test
    fun `reversed invoices and receipts contribute zero to the running balance`() {
        val raw = CustomersRawData(
            customers = listOf(customer()),
            invoices = listOf(
                ClientInvoiceLedgerDto(
                    id = "inv-1", date = "2026-01-01", customerId = "cust-1",
                    amount = 1000.0, status = "reversed",
                ),
                ClientInvoiceLedgerDto(
                    id = "inv-2", date = "2026-01-02", customerId = "cust-1",
                    amount = 500.0, status = "posted",
                ),
            ),
            receipts = emptyList(),
            projects = emptyList(),
        )

        val ledger = computeCustomerLedger(raw, customer().toDomain())

        assertEquals(500.0, ledger.outstanding, 0.001)
    }

    @Test
    fun `receipts with no customer are excluded and other customers are filtered out`() {
        val raw = CustomersRawData(
            customers = listOf(customer("cust-1"), customer("cust-2")),
            invoices = listOf(
                ClientInvoiceLedgerDto(id = "inv-1", date = "2026-01-01", customerId = "cust-2", amount = 999.0, status = "posted"),
            ),
            receipts = listOf(
                MoneyInLedgerDto(id = "rcpt-1", transactionDate = "2026-01-02", customerId = null, amount = 50.0, status = "posted"),
            ),
            projects = emptyList(),
        )

        val ledger = computeCustomerLedger(raw, customer("cust-1").toDomain())

        assertEquals(0, ledger.entries.size)
        assertEquals(0.0, ledger.outstanding, 0.001)
    }

    @Test
    fun `outstanding falls back to opening balance when there are no ledger entries`() {
        val raw = CustomersRawData(
            customers = listOf(customer(openingBalance = 250.0)),
            invoices = emptyList(),
            receipts = emptyList(),
            projects = emptyList(),
        )

        val ledger = computeCustomerLedger(raw, customer(openingBalance = 250.0).toDomain())

        assertEquals(250.0, ledger.outstanding, 0.001)
    }

    @Test
    fun `project id resolves to project name from the projects lookup`() {
        val raw = CustomersRawData(
            customers = listOf(customer()),
            invoices = listOf(
                ClientInvoiceLedgerDto(
                    id = "inv-1", date = "2026-01-01", customerId = "cust-1", projectId = "proj-1",
                    amount = 100.0, status = "posted",
                ),
            ),
            receipts = emptyList(),
            projects = listOf(ProjectNameDto(id = "proj-1", name = "Villa Construction")),
        )

        val ledger = computeCustomerLedger(raw, customer().toDomain())

        assertEquals("Villa Construction", ledger.entries.single().projectName)
    }

    @Test
    fun `summaries compute totals per customer independently`() {
        val raw = CustomersRawData(
            customers = listOf(customer("cust-1"), customer("cust-2", openingBalance = 100.0)),
            invoices = listOf(
                ClientInvoiceLedgerDto(id = "inv-1", date = "2026-01-01", customerId = "cust-1", amount = 300.0, status = "posted"),
            ),
            receipts = listOf(
                MoneyInLedgerDto(id = "rcpt-1", transactionDate = "2026-01-02", customerId = "cust-1", amount = 100.0, status = "posted"),
            ),
            projects = emptyList(),
        )

        val summaries = computeCustomerSummaries(raw)

        val first = summaries.single { it.customer.id == "cust-1" }
        assertEquals(300.0, first.totalInvoiced, 0.001)
        assertEquals(100.0, first.totalReceived, 0.001)
        assertEquals(200.0, first.outstanding, 0.001)

        val second = summaries.single { it.customer.id == "cust-2" }
        assertEquals(100.0, second.outstanding, 0.001)
    }
}
