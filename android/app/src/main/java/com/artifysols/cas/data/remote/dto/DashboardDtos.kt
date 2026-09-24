package com.artifysols.cas.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// One DTO per table this data source reads, each selecting only the columns
// the dashboard math actually needs (Postgrest `select=` narrows the
// response to these, per DTO field). Field names use @SerialName to map
// Postgres' snake_case columns onto idiomatic Kotlin camelCase properties.

@Serializable
data class AccountBalanceDto(
    @SerialName("current_balance") val currentBalance: Double,
    @SerialName("status") val status: String,
)

@Serializable
data class InvoiceAmountDto(
    @SerialName("amount") val amount: Double,
    @SerialName("status") val status: String,
)

@Serializable
data class MoneyInAmountDto(
    @SerialName("amount") val amount: Double,
    @SerialName("status") val status: String,
)

@Serializable
data class MoneyOutAmountDto(
    @SerialName("amount") val amount: Double,
    @SerialName("status") val status: String,
    @SerialName("payment_for") val paymentFor: String,
)

@Serializable
data class ProfileDto(
    @SerialName("id") val id: String,
    @SerialName("email") val email: String,
    @SerialName("full_name") val fullName: String? = null,
    @SerialName("role_code") val roleCode: String? = null,
)

@Serializable
data class RoleDto(
    @SerialName("code") val code: String,
    @SerialName("name") val name: String,
    @SerialName("permissions") val permissions: List<String> = emptyList(),
)
