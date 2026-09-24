package com.artifysols.cas.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CustomerDto(
    @SerialName("id") val id: String,
    @SerialName("code") val code: String,
    @SerialName("name") val name: String,
    @SerialName("contact_person") val contactPerson: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("vatin") val vatin: String? = null,
    @SerialName("opening_balance") val openingBalance: Double,
)

@Serializable
data class ClientInvoiceLedgerDto(
    @SerialName("id") val id: String,
    @SerialName("date") val date: String,
    @SerialName("customer_id") val customerId: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("document_ref") val documentRef: String? = null,
    @SerialName("invoice_number") val invoiceNumber: String? = null,
    @SerialName("amount") val amount: Double,
    @SerialName("status") val status: String,
    @SerialName("remarks") val remarks: String? = null,
    @SerialName("description") val description: String? = null,
)

@Serializable
data class MoneyInLedgerDto(
    @SerialName("id") val id: String,
    @SerialName("transaction_date") val transactionDate: String,
    @SerialName("customer_id") val customerId: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("document_ref") val documentRef: String? = null,
    @SerialName("amount") val amount: Double,
    @SerialName("status") val status: String,
    @SerialName("remarks") val remarks: String? = null,
)

@Serializable
data class ProjectNameDto(
    @SerialName("id") val id: String,
    @SerialName("name") val name: String,
)
