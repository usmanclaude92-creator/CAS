package com.artifysols.cas.data.repository

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.data.remote.SupabaseCustomersDataSource
import com.artifysols.cas.data.remote.toAppError
import com.artifysols.cas.domain.model.CustomerLedger
import com.artifysols.cas.domain.model.CustomerSummary
import com.artifysols.cas.domain.repository.CustomersRepository

class CustomersRepositoryImpl(
    private val dataSource: SupabaseCustomersDataSource,
) : CustomersRepository {

    override suspend fun getCustomerSummaries(): AppResult<List<CustomerSummary>> {
        return try {
            val raw = dataSource.fetchAll()
            AppResult.Success(computeCustomerSummaries(raw))
        } catch (t: Throwable) {
            AppResult.Failure(t.toAppError())
        }
    }

    override suspend fun getCustomerLedger(customerId: String): AppResult<CustomerLedger> {
        return try {
            val raw = dataSource.fetchAll()
            val customerDto = raw.customers.firstOrNull { it.id == customerId }
                ?: return AppResult.Failure(AppError.NotFound)
            AppResult.Success(computeCustomerLedger(raw, customerDto.toDomain()))
        } catch (t: Throwable) {
            AppResult.Failure(t.toAppError())
        }
    }
}
