package com.artifysols.cas.feature.customers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.artifysols.cas.core.designsystem.components.EmptyView
import com.artifysols.cas.core.designsystem.components.ErrorView
import com.artifysols.cas.core.designsystem.components.LoadingView
import com.artifysols.cas.core.designsystem.theme.CasColors
import com.artifysols.cas.core.designsystem.theme.CasSpacing
import com.artifysols.cas.domain.model.CustomerSummary
import java.text.NumberFormat
import java.util.Locale

internal fun formatOmr(amount: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.US).apply {
        minimumFractionDigits = 3
        maximumFractionDigits = 3
    }
    return "OMR ${formatter.format(amount)}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomersListRoute(
    viewModel: CustomersListViewModel,
    onSelectCustomer: (String) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    when (val current = state) {
        is CustomersListUiState.Loading -> LoadingView()
        is CustomersListUiState.Error -> ErrorView(error = current.error, onRetry = viewModel::load)
        is CustomersListUiState.Content -> {
            if (current.summaries.isEmpty()) {
                EmptyView(
                    title = "No customers yet",
                    message = "Customers will appear here once added in Business Masters.",
                )
            } else {
                PullToRefreshBox(
                    isRefreshing = current.isRefreshing,
                    onRefresh = viewModel::refresh,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(CasSpacing.lg),
                        verticalArrangement = Arrangement.spacedBy(CasSpacing.sm),
                    ) {
                        items(current.summaries, key = { it.customer.id }) { summary ->
                            CustomerRow(summary = summary, onClick = { onSelectCustomer(summary.customer.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomerRow(summary: CustomerSummary, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(CasSpacing.lg)) {
            Text(
                text = summary.customer.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = summary.customer.code,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            androidx.compose.foundation.layout.Spacer(Modifier.size(CasSpacing.sm))
            Text(
                text = "Outstanding: ${formatOmr(summary.outstanding)}",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                color = CasColors.Blue700,
            )
            Text(
                text = "Invoiced ${formatOmr(summary.totalInvoiced)} · Received ${formatOmr(summary.totalReceived)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
