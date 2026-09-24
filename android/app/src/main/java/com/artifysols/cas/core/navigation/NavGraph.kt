package com.artifysols.cas.core.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.artifysols.cas.core.common.AppResult
import com.artifysols.cas.core.designsystem.components.LoadingView
import com.artifysols.cas.core.designsystem.theme.CasSpacing
import com.artifysols.cas.core.di.AppContainer
import com.artifysols.cas.core.di.customerDetailViewModelFactory
import com.artifysols.cas.core.di.customersListViewModelFactory
import com.artifysols.cas.core.di.dashboardViewModelFactory
import com.artifysols.cas.core.di.loginViewModelFactory
import com.artifysols.cas.domain.model.User
import com.artifysols.cas.domain.repository.SessionState
import com.artifysols.cas.feature.auth.LoginRoute
import com.artifysols.cas.feature.customers.CustomerDetailRoute
import com.artifysols.cas.feature.customers.CustomersListRoute
import com.artifysols.cas.feature.dashboard.DashboardRoute
import com.artifysols.cas.feature.placeholder.ComingSoonScreen
import kotlinx.coroutines.launch

/**
 * Splash/session-restore gate: shows a loading state while Supabase decides
 * (from encrypted local storage) whether there's already a valid session,
 * then routes straight to the Dashboard or to Login — the user never sees a
 * flash of the wrong screen while that check is in flight.
 *
 * A single NavHost/navController is shared by every destination (login and
 * every authenticated module alike) so the login->dashboard and
 * logout->login transitions stay the same explicit, already-verified
 * `popUpTo` calls used before the drawer/module rollout — only the
 * authenticated destinations additionally wrap their content in
 * [AuthenticatedScaffold] for the drawer + top bar.
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
                    AuthenticatedScaffold(container, navController) {
                        val viewModel: com.artifysols.cas.feature.dashboard.DashboardViewModel =
                            viewModel(factory = dashboardViewModelFactory(container))
                        DashboardRoute(viewModel = viewModel)
                    }
                }
                composable(Routes.CUSTOMERS) {
                    AuthenticatedScaffold(container, navController) {
                        val viewModel: com.artifysols.cas.feature.customers.CustomersListViewModel =
                            viewModel(factory = customersListViewModelFactory(container))
                        CustomersListRoute(
                            viewModel = viewModel,
                            onSelectCustomer = { customerId -> navController.navigate(Routes.customerDetail(customerId)) },
                        )
                    }
                }
                composable(
                    route = Routes.CUSTOMER_DETAIL,
                    arguments = listOf(navArgument("customerId") { type = NavType.StringType }),
                ) { entry ->
                    val customerId = entry.arguments?.getString("customerId").orEmpty()
                    AuthenticatedScaffold(container, navController) {
                        val viewModel: com.artifysols.cas.feature.customers.CustomerDetailViewModel =
                            viewModel(
                                key = customerId,
                                factory = customerDetailViewModelFactory(container, customerId),
                            )
                        CustomerDetailRoute(viewModel = viewModel)
                    }
                }
                composable(Routes.APPROVALS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Pending Approvals") } }
                composable(Routes.PROJECTS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Projects & Costing") } }
                composable(Routes.BANKING) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Banking & Treasury") } }
                composable(Routes.PURCHASES) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Vendors & Payables") } }
                composable(Routes.BUSINESS_PARTNERS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Business Partners") } }
                composable(Routes.EXPENSES) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Direct Site Expenses") } }
                composable(Routes.REPORTS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Financial Reports") } }
                composable(Routes.MASTERS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Business Masters") } }
                composable(Routes.SYSTEM_CONFIG) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("System Configuration") } }
                composable(Routes.USERS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("User Management") } }
                composable(Routes.ROLES) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Roles & Permissions") } }
                composable(Routes.WORKFLOW_SETTINGS) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Workflow Settings") } }
                composable(Routes.MASTER_IMPORT_AUDIT) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Master Import Audit") } }
                composable(Routes.AUDIT) { AuthenticatedScaffold(container, navController) { ComingSoonScreen("Immutable Audit Log") } }
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

private fun screenTitle(route: String?): String = when (route) {
    null, Routes.DASHBOARD -> "Executive Dashboard"
    Routes.APPROVALS -> "Pending Approvals"
    Routes.PROJECTS -> "Projects & Costing"
    Routes.BANKING -> "Banking & Treasury"
    Routes.CUSTOMERS -> "Clients & Receivables"
    Routes.CUSTOMER_DETAIL -> "Customer Statement"
    Routes.PURCHASES -> "Vendors & Payables"
    Routes.BUSINESS_PARTNERS -> "Business Partners"
    Routes.EXPENSES -> "Direct Site Expenses"
    Routes.REPORTS -> "Financial Reports"
    Routes.MASTERS -> "Business Masters"
    Routes.SYSTEM_CONFIG -> "System Configuration"
    Routes.USERS -> "User Management"
    Routes.ROLES -> "Roles & Permissions"
    Routes.WORKFLOW_SETTINGS -> "Workflow Settings"
    Routes.MASTER_IMPORT_AUDIT -> "Master Import Audit"
    Routes.AUDIT -> "Immutable Audit Log"
    else -> "Artify CAS"
}

/**
 * Shared chrome for every authenticated screen: a permission-gated
 * navigation drawer (mirrors the web app's Sidebar.tsx exactly — same
 * routes, labels, permission codes) plus a top bar with a drawer toggle and
 * logout action. Fetches the current user once per screen to filter the
 * drawer; a small repeated cost, not a correctness issue.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuthenticatedScaffold(
    container: AppContainer,
    navController: NavHostController,
    content: @Composable () -> Unit,
) {
    var currentUser by remember { mutableStateOf<User?>(null) }
    LaunchedEffect(Unit) {
        val result = container.getCurrentUserUseCase()
        if (result is AppResult.Success) currentUser = result.data
    }

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val user = currentUser
    val visibleItems = navDrawerItems.filter { item ->
        item.permission == null || user?.hasPermission(item.permission) == true
    }
    val canAccessSystemConfig = user?.isSuperAdmin == true || user?.hasPermission("settings.view") == true

    fun navigateTo(route: String) {
        scope.launch { drawerState.close() }
        if (currentRoute != route) {
            navController.navigate(route) {
                popUpTo(Routes.DASHBOARD) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Text(
                    text = "Artify CAS",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(CasSpacing.lg),
                )
                HorizontalDivider()
                visibleItems.forEachIndexed { index, item ->
                    if (index == 0 || visibleItems[index - 1].section != item.section) {
                        when (item.section) {
                            NavSection.MASTERS -> DrawerSectionLabel("Master Data")
                            NavSection.AUDIT -> DrawerSectionLabel("Audit & Authentication")
                            NavSection.MAIN -> Unit
                        }
                    }
                    NavigationDrawerItem(
                        icon = { Icon(item.icon, contentDescription = null) },
                        label = { Text(item.label) },
                        selected = currentRoute == item.route,
                        onClick = { navigateTo(item.route) },
                        modifier = Modifier.padding(horizontal = CasSpacing.sm),
                    )
                }
                if (canAccessSystemConfig) {
                    HorizontalDivider()
                    NavigationDrawerItem(
                        icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                        label = { Text("System Configuration") },
                        selected = currentRoute == Routes.SYSTEM_CONFIG,
                        onClick = { navigateTo(Routes.SYSTEM_CONFIG) },
                        modifier = Modifier.padding(horizontal = CasSpacing.sm),
                    )
                }
            }
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(screenTitle(currentRoute)) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Filled.Menu, contentDescription = "Open menu")
                        }
                    },
                    actions = {
                        IconButton(onClick = {
                            scope.launch {
                                container.logoutUseCase()
                                navigateToLogin(navController)
                            }
                        }) {
                            Icon(Icons.Filled.Logout, contentDescription = "Log out")
                        }
                    },
                )
            },
        ) { padding ->
            Box(Modifier.padding(padding)) {
                content()
            }
        }
    }
}

@Composable
private fun DrawerSectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = CasSpacing.lg, top = CasSpacing.md, bottom = CasSpacing.xs),
    )
}
