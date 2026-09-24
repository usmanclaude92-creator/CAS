package com.artifysols.cas.domain.usecase

import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.DashboardSummary
import com.artifysols.cas.domain.repository.DashboardRepository

class GetDashboardSummaryUseCase(private val dashboardRepository: DashboardRepository) {
    suspend operator fun invoke(): AppResult<DashboardSummary> = dashboardRepository.getSummary()
}
