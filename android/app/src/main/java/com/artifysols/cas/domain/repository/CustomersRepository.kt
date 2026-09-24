package com.artifysols.cas.domain.repository

import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.CustomerLedger
import com.artifysols.cas.domain.model.CustomerSummary

interface CustomersRepository {
    suspend fun getCustomerSummaries(): AppResult<List<CustomerSummary>>
    suspend fun getCustomerLedger(customerId: String): AppResult<CustomerLedger>
}
