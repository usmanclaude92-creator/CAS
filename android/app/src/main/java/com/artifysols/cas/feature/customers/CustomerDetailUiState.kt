package com.artifysols.cas.feature.customers

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.domain.model.CustomerLedger

sealed interface CustomerDetailUiState {
    data object Loading : CustomerDetailUiState
    data class Content(val ledger: CustomerLedger) : CustomerDetailUiState
    data class Error(val error: AppError) : CustomerDetailUiState
}
