package com.artifysols.cas.core.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.artifysols.cas.core.designsystem.components.LoadingView
import com.artifysols.cas.core.di.AppContainer
import com.artifysols.cas.core.di.dashboardViewModelFactory
import com.artifysols.cas.core.di.loginViewModelFactory
import com.artifysols.cas.domain.repository.SessionState
import com.artifysols.cas.feature.auth.LoginRoute
import com.artifysols.cas.feature.dashboard.DashboardRoute

/**
 * Splash/session-restore gate: shows a loading state while Supabase decides
 * (from encrypted local storage) whether there's already a valid session,
 * then routes straight to the Dashboard or to Login — the user never sees a
 * flash of the wrong screen while that check is in flight.
 */
@Composable
fun CasNavGraph(container: AppContainer) {
    val navController = rememberNavController()
    val sessionState by container.authRepository.sessionState.collectAsStateWithLifecycle()

    when (sessionState) {
        SessionState.UNKNOWN -> LoadingView()
        SessionState.AUTHENTICATED, SessionState.UNAUTHENTICATED -> {
            NavHost(
                navController = navController,
                startDestination = if (sessionState == SessionState.AUTHENTICATED) Routes.DASHBOARD else Routes.LOGIN,
            ) {
                composable(Routes.LOGIN) {
                    val viewModel: com.artifysols.cas.feature.auth.LoginViewModel =
                        viewModel(factory = loginViewModelFactory(container))
                    LoginRoute(
                        viewModel = viewModel,
                        onLoginSuccess = { navigateToDashboard(navController) },
                    )
                }
                composable(Routes.DASHBOARD) {
                    val viewModel: com.artifysols.cas.feature.dashboard.DashboardViewModel =
                        viewModel(factory = dashboardViewModelFactory(container))
                    DashboardRoute(
                        viewModel = viewModel,
                        onLoggedOut = { navigateToLogin(navController) },
                    )
                }
            }
        }
    }
}

private fun navigateToDashboard(navController: NavHostController) {
    navController.navigate(Routes.DASHBOARD) {
        popUpTo(Routes.LOGIN) { inclusive = true }
    }
}

private fun navigateToLogin(navController: NavHostController) {
    navController.navigate(Routes.LOGIN) {
        popUpTo(0) { inclusive = true }
    }
}
