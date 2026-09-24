package com.artifysols.cas.domain.repository

import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.User
import kotlinx.coroutines.flow.StateFlow

enum class SessionState { UNKNOWN, AUTHENTICATED, UNAUTHENTICATED }

interface AuthRepository {
    /** Reflects the restored/updated Supabase session; UNKNOWN until the
     * initial session-restore check completes (drives the splash gate). */
    val sessionState: StateFlow<SessionState>

    suspend fun login(email: String, password: String): AppResult<User>
    suspend fun logout(): AppResult<Unit>
    suspend fun currentUser(): AppResult<User>
}
