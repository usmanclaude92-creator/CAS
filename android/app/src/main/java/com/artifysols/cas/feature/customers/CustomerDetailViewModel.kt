package com.artifysols.cas.feature.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.usecase.GetCustomerLedgerUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class CustomerDetailViewModel(
    private val customerId: String,
    private val getCustomerLedgerUseCase: GetCustomerLedgerUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<CustomerDetailUiState>(CustomerDetailUiState.Loading)
    val uiState: StateFlow<CustomerDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { CustomerDetailUiState.Loading }
            when (val result = getCustomerLedgerUseCase(customerId)) {
                is AppResult.Success -> _uiState.update { CustomerDetailUiState.Content(result.data) }
                is AppResult.Failure -> _uiState.update { CustomerDetailUiState.Error(result.error) }
            }
        }
    }
}
