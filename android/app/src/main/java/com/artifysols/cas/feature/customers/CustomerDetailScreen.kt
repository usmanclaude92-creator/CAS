package com.artifysols.cas.feature.customers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.artifysols.cas.core.designsystem.components.EmptyView
import com.artifysols.cas.core.designsystem.components.ErrorView
import com.artifysols.cas.core.designsystem.components.LoadingView
import com.artifysols.cas.core.designsystem.theme.CasColors
import com.artifysols.cas.core.designsystem.theme.CasSpacing
import com.artifysols.cas.domain.model.CustomerLedger
import com.artifysols.cas.domain.model.CustomerLedgerEntry
import com.artifysols.cas.domain.model.CustomerLedgerEntryType

@Composable
fun CustomerDetailRoute(viewModel: CustomerDetailViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    when (val current = state) {
        is CustomerDetailUiState.Loading -> LoadingView()
        is CustomerDetailUiState.Error -> ErrorView(error = current.error, onRetry = viewModel::load)
        is CustomerDetailUiState.Content -> CustomerDetailContent(current.ledger)
    }
}

@Composable
private fun CustomerDetailContent(ledger: CustomerLedger) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(CasSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(CasSpacing.sm),
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(CasSpacing.lg)) {
                    Text(
                        text = ledger.customer.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = ledger.customer.code,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (ledger.customer.vatin != null) {
                        Text("VATIN: ${ledger.customer.vatin}", style = MaterialTheme.typography.bodySmall)
                    }
                    androidx.compose.foundation.layout.Spacer(Modifier.size(CasSpacing.md))
                    Text(
                        text = "Outstanding: ${formatOmr(ledger.outstanding)}",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = CasColors.Blue700,
                    )
                    Text(
                        text = "Opening balance: ${formatOmr(ledger.customer.openingBalance)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        if (ledger.entries.isEmpty()) {
            item {
                EmptyView(
                    title = "No ledger entries",
                    message = "No invoices or receipts recorded for this customer yet.",
                )
            }
        } else {
            items(ledger.entries, key = { it.id }) { entry -> LedgerEntryRow(entry) }
        }
    }
}

@Composable
private fun LedgerEntryRow(entry: CustomerLedgerEntry) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(CasSpacing.md)) {
            Text(
                text = if (entry.type == CustomerLedgerEntryType.INVOICE) "Invoice / IPC" else "Client Receipt",
                style = MaterialTheme.typography.labelMedium,
                color = if (entry.type == CustomerLedgerEntryType.INVOICE) CasColors.Blue700 else CasColors.Emerald600,
                fontWeight = FontWeight.SemiBold,
            )
            Text(entry.description, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = listOfNotNull(entry.date, entry.projectName, entry.documentRef).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = CasSpacing.xs))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                if (entry.invoiced > 0) {
                    Text(
                        text = "Invoice: ${formatOmr(entry.invoiced)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = CasColors.Blue700,
                    )
                }
                if (entry.received > 0) {
                    Text(
                        text = "Received: ${formatOmr(entry.received)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = CasColors.Emerald600,
                    )
                }
                Text(
                    text = "Bal: ${formatOmr(entry.outstanding)}",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
