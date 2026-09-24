package com.artifysols.cas.data.repository

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.data.remote.SupabaseAuthDataSource
import com.artifysols.cas.data.remote.toAppError
import com.artifysols.cas.domain.model.User
import com.artifysols.cas.domain.repository.AuthRepository
import com.artifysols.cas.domain.repository.SessionState
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class AuthRepositoryImpl(
    private val dataSource: SupabaseAuthDataSource,
) : AuthRepository {

    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // Deliberately not an exhaustive `when` over SessionStatus's exact subtypes:
    // this was written without the ability to compile against the real
    // supabase-kt library (see PR description), so only the two most stable,
    // long-standing cases are named explicitly. Anything else (a refresh
    // failure, still restoring from storage, etc.) falls back to UNKNOWN
    // rather than guessing — worst case the splash loading state shows a
    // little longer, instead of risking a build break on an unverified
    // subtype name.
    override val sessionState: StateFlow<SessionState> = dataSource.sessionStatus
        .map { status ->
            when (status) {
                is SessionStatus.Authenticated -> SessionState.AUTHENTICATED
                is SessionStatus.NotAuthenticated -> SessionState.UNAUTHENTICATED
                else -> SessionState.UNKNOWN
            }
        }
        .stateIn(repositoryScope, SharingStarted.Eagerly, SessionState.UNKNOWN)

    override suspend fun login(email: String, password: String): AppResult<User> {
        return try {
            dataSource.signIn(email, password)
            currentUser()
        } catch (t: Throwable) {
            AppResult.Failure(t.toAppError())
        }
    }

    override suspend fun logout(): AppResult<Unit> {
        return try {
            dataSource.signOut()
            AppResult.Success(Unit)
        } catch (t: Throwable) {
            AppResult.Failure(t.toAppError())
        }
    }

    override suspend fun currentUser(): AppResult<User> {
        val userId = dataSource.currentUserId()
            ?: return AppResult.Failure(AppError.Unauthorized)
        return try {
            val profile = dataSource.fetchProfile(userId)
            val roleName = profile.roleCode?.let { dataSource.fetchRoleName(it) }
            AppResult.Success(
                User(
                    id = profile.id,
                    email = profile.email,
                    fullName = profile.fullName,
                    roleName = roleName,
                )
            )
        } catch (t: Throwable) {
            AppResult.Failure(t.toAppError())
        }
    }
}
