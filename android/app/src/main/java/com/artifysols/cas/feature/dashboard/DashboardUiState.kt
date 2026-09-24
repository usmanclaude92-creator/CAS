package com.artifysols.cas.feature.dashboard

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.domain.model.DashboardSummary
import com.artifysols.cas.domain.model.User

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Content(
        val user: User?,
        val summary: DashboardSummary,
        val isRefreshing: Boolean = false,
    ) : DashboardUiState
    data class Error(val error: AppError) : DashboardUiState
}
