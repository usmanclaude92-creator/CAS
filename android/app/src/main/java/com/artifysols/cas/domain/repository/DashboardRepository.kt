package com.artifysols.cas.domain.repository

import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.DashboardSummary

interface DashboardRepository {
    suspend fun getSummary(): AppResult<DashboardSummary>
}
