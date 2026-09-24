package com.artifysols.cas.feature.customers

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.domain.model.CustomerSummary

sealed interface CustomersListUiState {
    data object Loading : CustomersListUiState
    data class Content(
        val summaries: List<CustomerSummary>,
        val isRefreshing: Boolean = false,
    ) : CustomersListUiState
    data class Error(val error: AppError) : CustomersListUiState
}
