package com.artifysols.cas.feature.auth

import com.artifysols.cas.core.common.AppError

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val emailError: String? = null,
    val passwordError: String? = null,
    val generalError: AppError? = null,
    val loginSucceeded: Boolean = false,
)
