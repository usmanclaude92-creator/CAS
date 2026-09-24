package com.artifysols.cas.feature.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.RequestQuote
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.artifysols.cas.core.designsystem.components.ErrorView
import com.artifysols.cas.core.designsystem.components.LoadingView
import com.artifysols.cas.core.designsystem.components.StatCard
import com.artifysols.cas.core.designsystem.theme.CasColors
import com.artifysols.cas.core.designsystem.theme.CasSpacing
import com.artifysols.cas.domain.model.DashboardSummary
import java.text.NumberFormat
import java.util.Locale

private fun formatOmr(amount: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.US).apply {
        minimumFractionDigits = 3
        maximumFractionDigits = 3
    }
    return "OMR ${formatter.format(amount)}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardRoute(
    viewModel: DashboardViewModel,
    onLoggedOut: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Executive Dashboard") },
                actions = {
                    IconButton(onClick = { viewModel.logout(onLoggedOut) }) {
                        Icon(Icons.Filled.Logout, contentDescription = "Log out")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(),
            )
        },
    ) { padding ->
        when (val current = state) {
            is DashboardUiState.Loading -> LoadingView(Modifier.padding(padding))
            is DashboardUiState.Error -> ErrorView(
                error = current.error,
                onRetry = viewModel::load,
                modifier = Modifier.padding(padding),
            )
            is DashboardUiState.Content -> PullToRefreshBox(
                isRefreshing = current.isRefreshing,
                onRefresh = viewModel::refresh,
                modifier = Modifier.padding(padding).fillMaxSize(),
            ) {
                DashboardContent(current)
            }
        }
    }
}

@Composable
private fun DashboardContent(content: DashboardUiState.Content) {
    val summary = content.summary
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(CasSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(CasSpacing.md),
    ) {
        item {
            Column {
                Text(
                    text = "Welcome back${content.user?.fullName?.let { ", $it" } ?: ""}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                if (content.user?.roleName != null) {
                    Text(
                        text = content.user.roleName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            StatCard(
                label = "Liquid Funds (Treasury)",
                value = formatOmr(summary.liquidFunds),
                icon = Icons.Filled.AccountBalance,
                accentColor = CasColors.Emerald600,
                breakdown = "Bank ${formatOmr(summary.bankBalance)} · Cash ${formatOmr(summary.cashInHand)}",
            )
        }

        item {
            StatCard(
                label = "Client Receivables",
                value = formatOmr(summary.clientReceivables),
                icon = Icons.Filled.RequestQuote,
                accentColor = CasColors.Blue600,
                breakdown = "Invoiced ${formatOmr(summary.totalInvoiced)} · Collected ${formatOmr(summary.totalCollected)}",
            )
        }

        item {
            StatCard(
                label = "Vendor Payables",
                value = formatOmr(summary.vendorPayables),
                icon = Icons.Filled.TrendingDown,
                accentColor = CasColors.Amber600,
                breakdown = "Billed ${formatOmr(summary.totalBilled)} · Paid ${formatOmr(summary.totalPaid)}",
            )
        }
    }
}
