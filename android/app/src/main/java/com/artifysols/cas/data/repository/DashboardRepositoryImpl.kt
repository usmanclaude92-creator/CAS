package com.artifysols.cas.data.repository

import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.data.remote.SupabaseDashboardDataSource
import com.artifysols.cas.data.remote.toAppError
import com.artifysols.cas.domain.model.DashboardSummary
import com.artifysols.cas.domain.repository.DashboardRepository

class DashboardRepositoryImpl(
    private val dataSource: SupabaseDashboardDataSource,
) : DashboardRepository {

    override suspend fun getSummary(): AppResult<DashboardSummary> {
        return try {
            val raw = dataSource.fetchRaw()
            AppResult.Success(computeDashboardSummary(raw))
        } catch (t: Throwable) {
            AppResult.Failure(t.toAppError())
        }
    }
}
