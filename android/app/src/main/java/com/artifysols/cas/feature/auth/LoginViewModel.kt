package com.artifysols.cas.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.usecase.LoginUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class LoginViewModel(private val loginUseCase: LoginUseCase) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onEmailChange(value: String) {
        _uiState.update { it.copy(email = value, emailError = null, generalError = null) }
    }

    fun onPasswordChange(value: String) {
        _uiState.update { it.copy(password = value, passwordError = null, generalError = null) }
    }

    fun onSubmit() {
        val state = _uiState.value
        if (state.isLoading) return

        _uiState.update { it.copy(isLoading = true, generalError = null, emailError = null, passwordError = null) }

        viewModelScope.launch {
            when (val result = loginUseCase(state.email, state.password)) {
                is AppResult.Success -> {
                    _uiState.update { it.copy(isLoading = false, loginSucceeded = true) }
                }
                is AppResult.Failure -> {
                    val error = result.error
                    _uiState.update {
                        if (error is AppError.Validation) {
                            it.copy(
                                isLoading = false,
                                emailError = if (error.field == "email") error.reason else null,
                                passwordError = if (error.field == "password") error.reason else null,
                                generalError = if (error.field == null) error else null,
                            )
                        } else {
                            it.copy(isLoading = false, generalError = error)
                        }
                    }
                }
            }
        }
    }
}
