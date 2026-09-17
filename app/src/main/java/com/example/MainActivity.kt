package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.example.data.local.CasDatabase
import com.example.data.repository.CasRepository
import com.example.theme.ConstructionAccountingTheme
import com.example.theme.ConstructionBlueLight
import com.example.theme.Slate400
import com.example.theme.Slate900
import com.example.theme.Slate50
import com.example.ui.components.CasDialogsContainer
import com.example.ui.screens.*
import com.example.ui.viewmodel.CasViewModel
import com.example.ui.viewmodel.CasViewModelFactory

enum class CasScreen(val title: String, val icon: ImageVector) {
    DASHBOARD("Dashboard", Icons.Default.Dashboard),
    PROJECTS("Projects", Icons.Default.Business),
    TREASURY("Treasury", Icons.Default.AccountBalance),
    OPERATIONS("Operations", Icons.Default.ReceiptLong),
    APPROVALS("Approvals", Icons.Default.CheckCircle),
    REPORTS("Reports", Icons.Default.Assessment),
    MASTERS("Masters", Icons.Default.Tune)
}

class MainActivity : ComponentActivity() {

    private val viewModel: CasViewModel by viewModels {
        val database = CasDatabase.getDatabase(applicationContext, lifecycleScope)
        val supabaseClient = com.example.data.remote.SupabaseClient(applicationContext)
        val syncManager = com.example.data.sync.CasSyncManager(database.casDao(), supabaseClient)
        val repository = CasRepository(database.casDao(), supabaseClient, syncManager)
        CasViewModelFactory(repository)
    }

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ConstructionAccountingTheme {
                var currentScreen by remember { mutableStateOf(CasScreen.DASHBOARD) }
                val uiState by viewModel.uiState.collectAsState()
                val stats by viewModel.dashboardStats.collectAsState()
                val snackbarHostState = remember { SnackbarHostState() }

                LaunchedEffect(uiState.userMessage) {
                    uiState.userMessage?.let { msg ->
                        snackbarHostState.showSnackbar(msg)
                        viewModel.clearUserMessage()
                    }
                }

                Scaffold(
                    modifier = Modifier.fillMaxSize().testTag("main_scaffold"),
                    contentWindowInsets = WindowInsets.safeDrawing,
                    snackbarHost = { SnackbarHost(snackbarHostState) },
                    topBar = {
                        TopAppBar(
                            title = {
                                Column {
                                    Text(
                                        text = stringResource(R.string.app_name),
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 18.sp
                                        ),
                                        color = Slate50
                                    )
                                    Text(
                                        text = "${uiState.currentUserName} (${uiState.currentUserRole.displayName})",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = ConstructionBlueLight
                                    )
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = Slate900,
                                titleContentColor = Slate50
                            ),
                            actions = {
                                IconButton(
                                    onClick = { viewModel.setSupabaseDialog(true) },
                                    modifier = Modifier.size(48.dp).testTag("top_bar_supabase_btn")
                                ) {
                                    if (uiState.isSupabaseConfigured) {
                                        Icon(
                                            Icons.Default.CloudDone,
                                            contentDescription = "Supabase Cloud Database Connected",
                                            tint = com.example.theme.EmeraldSuccess
                                        )
                                    } else {
                                        Icon(
                                            Icons.Default.CloudQueue,
                                            contentDescription = "Connect Supabase Database",
                                            tint = Slate400
                                        )
                                    }
                                }
                                IconButton(
                                    onClick = { currentScreen = CasScreen.MASTERS },
                                    modifier = Modifier.size(48.dp).testTag("top_bar_switch_role_btn")
                                ) {
                                    Icon(Icons.Default.AccountCircle, contentDescription = "User Persona", tint = Slate400)
                                }
                            }
                        )
                    },
                    bottomBar = {
                        NavigationBar(
                            containerColor = Slate900,
                            modifier = Modifier.testTag("bottom_navigation_bar")
                        ) {
                            CasScreen.values().forEach { screen ->
                                val isSelected = currentScreen == screen
                                NavigationBarItem(
                                    selected = isSelected,
                                    onClick = { currentScreen = screen },
                                    icon = {
                                        if (screen == CasScreen.APPROVALS && stats.pendingApprovalsCount > 0) {
                                            BadgedBox(
                                                badge = {
                                                    Badge { Text("${stats.pendingApprovalsCount}") }
                                                }
                                            ) {
                                                Icon(screen.icon, contentDescription = screen.title)
                                            }
                                        } else {
                                            Icon(screen.icon, contentDescription = screen.title)
                                        }
                                    },
                                    label = {
                                        Text(
                                            text = screen.title,
                                            fontSize = 10.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = ConstructionBlueLight,
                                        selectedTextColor = ConstructionBlueLight,
                                        unselectedIconColor = Slate400,
                                        unselectedTextColor = Slate400,
                                        indicatorColor = Slate900
                                    ),
                                    modifier = Modifier.testTag("nav_item_${screen.name.lowercase()}")
                                )
                            }
                        }
                    }
                ) { paddingValues ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues)
                    ) {
                        when (currentScreen) {
                            CasScreen.DASHBOARD -> DashboardScreen(
                                viewModel = viewModel,
                                onNavigateToProjects = { currentScreen = CasScreen.PROJECTS },
                                onNavigateToApprovals = { currentScreen = CasScreen.APPROVALS }
                            )
                            CasScreen.PROJECTS -> ProjectsScreen(viewModel = viewModel)
                            CasScreen.TREASURY -> TreasuryScreen(viewModel = viewModel)
                            CasScreen.OPERATIONS -> OperationsScreen(viewModel = viewModel)
                            CasScreen.APPROVALS -> ApprovalsScreen(viewModel = viewModel)
                            CasScreen.REPORTS -> ReportsScreen(viewModel = viewModel)
                            CasScreen.MASTERS -> MastersScreen(viewModel = viewModel)
                        }

                        // Modal Dialogs Layer
                        CasDialogsContainer(viewModel = viewModel)
                    }
                }
            }
        }
    }
}
