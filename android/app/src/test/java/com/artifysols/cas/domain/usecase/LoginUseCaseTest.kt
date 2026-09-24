package com.artifysols.cas.domain.usecase

import com.artifysols.cas.core.common.AppError
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.domain.model.User
import com.artifysols.cas.domain.repository.AuthRepository
import com.artifysols.cas.domain.repository.SessionState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private class FakeAuthRepository : AuthRepository {
    override val sessionState = MutableStateFlow(SessionState.UNKNOWN)
    var loginCallCount = 0

    override suspend fun login(email: String, password: String): AppResult<User> {
        loginCallCount++
        return AppResult.Success(
            User(id = "1", email = email, fullName = "Test User", roleCode = "admin", roleName = "Admin")
        )
    }

    override suspend fun logout(): AppResult<Unit> = AppResult.Success(Unit)
    override suspend fun currentUser(): AppResult<User> =
        AppResult.Success(
            User(id = "1", email = "test@artifysols.com", fullName = "Test User", roleCode = "admin", roleName = "Admin")
        )
}

class LoginUseCaseTest {

    @Test
    fun `rejects blank email without calling the repository`() = runBlocking {
        val repository = FakeAuthRepository()
        val useCase = LoginUseCase(repository)

        val result = useCase("", "password123")

        assertTrue(result is AppResult.Failure)
        assertEquals("email", ((result as AppResult.Failure).error as AppError.Validation).field)
        assertEquals(0, repository.loginCallCount)
    }

    @Test
    fun `rejects an email missing an at-sign`() = runBlocking {
        val repository = FakeAuthRepository()
        val useCase = LoginUseCase(repository)

        val result = useCase("not-an-email", "password123")

        assertTrue(result is AppResult.Failure)
        assertEquals(0, repository.loginCallCount)
    }

    @Test
    fun `rejects an empty password`() = runBlocking {
        val repository = FakeAuthRepository()
        val useCase = LoginUseCase(repository)

        val result = useCase("admin@artifysols.com", "")

        assertTrue(result is AppResult.Failure)
        assertEquals("password", ((result as AppResult.Failure).error as AppError.Validation).field)
        assertEquals(0, repository.loginCallCount)
    }

    @Test
    fun `delegates to the repository once input is valid`() = runBlocking {
        val repository = FakeAuthRepository()
        val useCase = LoginUseCase(repository)

        val result = useCase("admin@artifysols.com", "Abcd@1234")

        assertTrue(result is AppResult.Success)
        assertEquals(1, repository.loginCallCount)
    }
}
