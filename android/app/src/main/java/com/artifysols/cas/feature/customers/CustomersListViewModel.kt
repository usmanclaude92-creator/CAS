package com.artifysols.cas.feature.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.usecase.GetCustomerSummariesUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class CustomersListViewModel(
    private val getCustomerSummariesUseCase: GetCustomerSummariesUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<CustomersListUiState>(CustomersListUiState.Loading)
    val uiState: StateFlow<CustomersListUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            when (val result = getCustomerSummariesUseCase()) {
                is AppResult.Success -> _uiState.update { CustomersListUiState.Content(result.data) }
                is AppResult.Failure -> _uiState.update { CustomersListUiState.Error(result.error) }
            }
        }
    }

    fun refresh() {
        val current = _uiState.value
        if (current !is CustomersListUiState.Content) {
            load()
            return
        }
        _uiState.update { current.copy(isRefreshing = true) }
        viewModelScope.launch {
            when (val result = getCustomerSummariesUseCase()) {
                is AppResult.Success -> _uiState.update { CustomersListUiState.Content(result.data, isRefreshing = false) }
                is AppResult.Failure -> _uiState.update {
                    (it as? CustomersListUiState.Content)?.copy(isRefreshing = false) ?: it
                }
            }
        }
    }
}
