package com.artifysols.cas.domain.usecase

import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.CustomerLedger
import com.artifysols.cas.domain.model.CustomerSummary
import com.artifysols.cas.domain.repository.CustomersRepository

class GetCustomerSummariesUseCase(private val repository: CustomersRepository) {
    suspend operator fun invoke(): AppResult<List<CustomerSummary>> = repository.getCustomerSummaries()
}

class GetCustomerLedgerUseCase(private val repository: CustomersRepository) {
    suspend operator fun invoke(customerId: String): AppResult<CustomerLedger> =
        repository.getCustomerLedger(customerId)
}
