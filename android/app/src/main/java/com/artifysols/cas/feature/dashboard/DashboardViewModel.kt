package com.artifysols.cas.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.usecase.GetCurrentUserUseCase
import com.artifysols.cas.domain.usecase.GetDashboardSummaryUseCase
import com.artifysols.cas.domain.usecase.LogoutUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class DashboardViewModel(
    private val getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
    private val getCurrentUserUseCase: GetCurrentUserUseCase,
    private val logoutUseCase: LogoutUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            val userResult = getCurrentUserUseCase()
            when (val summaryResult = getDashboardSummaryUseCase()) {
                is AppResult.Success -> {
                    val user = (userResult as? AppResult.Success)?.data
                    _uiState.update { DashboardUiState.Content(user = user, summary = summaryResult.data) }
                }
                is AppResult.Failure -> {
                    _uiState.update { DashboardUiState.Error(summaryResult.error) }
                }
            }
        }
    }

    fun refresh() {
        val current = _uiState.value
        if (current !is DashboardUiState.Content) {
            load()
            return
        }
        _uiState.update { current.copy(isRefreshing = true) }
        viewModelScope.launch {
            when (val summaryResult = getDashboardSummaryUseCase()) {
                is AppResult.Success -> {
                    _uiState.update {
                        (it as? DashboardUiState.Content)?.copy(summary = summaryResult.data, isRefreshing = false)
                            ?: DashboardUiState.Content(user = current.user, summary = summaryResult.data)
                    }
                }
                is AppResult.Failure -> {
                    _uiState.update { (it as? DashboardUiState.Content)?.copy(isRefreshing = false) ?: it }
                }
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            logoutUseCase()
            onLoggedOut()
        }
    }
}
