package com.artifysols.cas.domain.usecase

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.User
import com.artifysols.cas.domain.repository.AuthRepository
import com.artifysols.cas.domain.repository.SessionState
import kotlinx.coroutines.flow.StateFlow

/** Validates input locally before it ever reaches the network — a 401 from
 * the server for an empty password is a wasted round trip and a worse error
 * message than we can give the user immediately. */
class LoginUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(email: String, password: String): AppResult<User> {
        val trimmedEmail = email.trim()
        if (trimmedEmail.isEmpty() || !trimmedEmail.contains("@")) {
            return AppResult.Failure(AppError.Validation("email", "Enter a valid email address."))
        }
        if (password.isEmpty()) {
            return AppResult.Failure(AppError.Validation("password", "Enter your password."))
        }
        return authRepository.login(trimmedEmail, password)
    }
}

class LogoutUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(): AppResult<Unit> = authRepository.logout()
}

class ObserveSessionStateUseCase(private val authRepository: AuthRepository) {
    operator fun invoke(): StateFlow<SessionState> = authRepository.sessionState
}

class GetCurrentUserUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(): AppResult<User> = authRepository.currentUser()
}
