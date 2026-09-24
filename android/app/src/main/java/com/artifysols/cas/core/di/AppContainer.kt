package com.artifysols.cas.core.di

import android.content.Context
import com.artifysols.cas.core.network.SupabaseClientProvider
import com.artifysols.cas.data.remote.SupabaseAuthDataSource
import com.artifysols.cas.data.remote.SupabaseCustomersDataSource
import com.artifysols.cas.data.remote.SupabaseDashboardDataSource
import com.artifysols.cas.data.repository.AuthRepositoryImpl
import com.artifysols.cas.data.repository.CustomersRepositoryImpl
import com.artifysols.cas.data.repository.DashboardRepositoryImpl
import com.artifysols.cas.domain.repository.AuthRepository
import com.artifysols.cas.domain.repository.CustomersRepository
import com.artifysols.cas.domain.repository.DashboardRepository
import com.artifysols.cas.domain.usecase.GetCurrentUserUseCase
import com.artifysols.cas.domain.usecase.GetCustomerLedgerUseCase
import com.artifysols.cas.domain.usecase.GetCustomerSummariesUseCase
import com.artifysols.cas.domain.usecase.GetDashboardSummaryUseCase
import com.artifysols.cas.domain.usecase.LoginUseCase
import com.artifysols.cas.domain.usecase.LogoutUseCase
import com.artifysols.cas.domain.usecase.ObserveSessionStateUseCase

/**
 * Manual dependency container instead of Hilt/Dagger. This is a deliberate
 * trade-off for a first vertical slice built without the ability to compile
 * or run the project locally (see the PR description): a small hand-wired
 * graph is something a reviewer can read top-to-bottom and be confident is
 * correct, where a KSP-generated Hilt graph would be one more thing that
 * either builds or silently doesn't, with no way for me to verify it here.
 * Migrating to Hilt later is a mechanical, low-risk change once CI/local
 * builds are green.
 */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    private val supabaseClient by lazy { SupabaseClientProvider.get(appContext) }

    private val authDataSource by lazy { SupabaseAuthDataSource(supabaseClient) }
    private val dashboardDataSource by lazy { SupabaseDashboardDataSource(supabaseClient) }
    private val customersDataSource by lazy { SupabaseCustomersDataSource(supabaseClient) }

    val authRepository: AuthRepository by lazy { AuthRepositoryImpl(authDataSource) }
    val dashboardRepository: DashboardRepository by lazy { DashboardRepositoryImpl(dashboardDataSource) }
    val customersRepository: CustomersRepository by lazy { CustomersRepositoryImpl(customersDataSource) }

    val loginUseCase by lazy { LoginUseCase(authRepository) }
    val logoutUseCase by lazy { LogoutUseCase(authRepository) }
    val observeSessionStateUseCase by lazy { ObserveSessionStateUseCase(authRepository) }
    val getCurrentUserUseCase by lazy { GetCurrentUserUseCase(authRepository) }
    val getDashboardSummaryUseCase by lazy { GetDashboardSummaryUseCase(dashboardRepository) }
    val getCustomerSummariesUseCase by lazy { GetCustomerSummariesUseCase(customersRepository) }
    val getCustomerLedgerUseCase by lazy { GetCustomerLedgerUseCase(customersRepository) }
}
