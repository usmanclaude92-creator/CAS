package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.TransactionEntity
import com.example.theme.*
import com.example.ui.components.SectionHeader
import com.example.ui.components.StatCard
import com.example.ui.components.StatusBadge
import com.example.ui.components.formatOmr
import com.example.ui.viewmodel.CasViewModel

@Composable
fun DashboardScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier,
    onNavigateToProjects: () -> Unit = {},
    onNavigateToApprovals: () -> Unit = {}
) {
    val stats by viewModel.dashboardStats.collectAsState()
    val profitabilities by viewModel.projectProfitabilities.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("dashboard_screen")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // Top Banner / Inactivity Security Indicator
        item {
            Card(
                modifier = Modifier.fillMaxWidth().testTag("system_status_banner"),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = "Security Active",
                        tint = EmeraldSuccess,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Authenticated as ${uiState.currentUserName}",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = Slate50
                        )
                        Text(
                            text = "Role: ${uiState.currentUserRole.displayName} • Project-wise Cost Accounting Active",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Slate400
                        )
                    }
                    if (stats.pendingApprovalsCount > 0) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = AmberWarningBg,
                            modifier = Modifier.clickable { onNavigateToApprovals() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "${stats.pendingApprovalsCount} Pending",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = AmberWarning
                                )
                            }
                        }
                    }
                }
            }
        }

        // Key Financial Metrics Grid (Treasury, AR, AP, Net Position)
        item {
            SectionHeader(
                title = "Executive Treasury & Liquidity",
                subtitle = "Real-time cash flow position across bank and field safes"
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = "Total Treasury Balance",
                    amount = stats.totalTreasuryBalance,
                    subtitle = "Bank & Cash Accounts",
                    icon = Icons.Default.AccountBalance,
                    iconTint = ConstructionBlueLight,
                    modifier = Modifier.weight(1f),
                    testTag = "stat_treasury_balance"
                )
                StatCard(
                    title = "Net Cash Position",
                    amount = stats.netCashPosition,
                    subtitle = "Treasury + AR - AP",
                    icon = Icons.AutoMirrored.Filled.TrendingUp,
                    iconTint = EmeraldSuccess,
                    modifier = Modifier.weight(1f),
                    testTag = "stat_net_position"
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = "Accounts Receivable",
                    amount = stats.accountsReceivable,
                    subtitle = "Pending Client IPCs",
                    icon = Icons.Default.MonetizationOn,
                    iconTint = AmberWarning,
                    modifier = Modifier.weight(1f),
                    testTag = "stat_accounts_receivable"
                )
                StatCard(
                    title = "Accounts Payable",
                    amount = stats.accountsPayable,
                    subtitle = "Pending Vendor Bills",
                    icon = Icons.AutoMirrored.Filled.TrendingDown,
                    iconTint = RoseError,
                    modifier = Modifier.weight(1f),
                    testTag = "stat_accounts_payable"
                )
            }
        }

        // Fast Action Buttons Bar
        item {
            SectionHeader(title = "Financial Operations")
            Spacer(modifier = Modifier.height(6.dp))
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    Button(
                        onClick = { viewModel.setAddInvoiceDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue),
                        modifier = Modifier.testTag("action_new_invoice_btn")
                    ) {
                        Icon(Icons.Default.Receipt, contentDescription = "Client IPC", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("+ Client Invoice")
                    }
                }
                item {
                    Button(
                        onClick = { viewModel.setAddPurchaseDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                        modifier = Modifier.testTag("action_new_purchase_btn")
                    ) {
                        Icon(Icons.Default.ShoppingCart, contentDescription = "Vendor Bill", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("+ Vendor Purchase")
                    }
                }
                item {
                    Button(
                        onClick = { viewModel.setAddExpenseDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                        modifier = Modifier.testTag("action_new_expense_btn")
                    ) {
                        Icon(Icons.Default.LocalGasStation, contentDescription = "Site Expense", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("+ Site Expense")
                    }
                }
                item {
                    Button(
                        onClick = { viewModel.setAddMoneyInDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldSuccessBg),
                        modifier = Modifier.testTag("action_money_in_btn")
                    ) {
                        Icon(Icons.Default.ArrowDownward, contentDescription = "Receipt", tint = EmeraldSuccess, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Money In", color = EmeraldSuccess)
                    }
                }
                item {
                    Button(
                        onClick = { viewModel.setAddMoneyOutDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = RoseErrorBg),
                        modifier = Modifier.testTag("action_money_out_btn")
                    ) {
                        Icon(Icons.Default.ArrowUpward, contentDescription = "Disbursement", tint = RoseError, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Money Out", color = RoseError)
                    }
                }
                item {
                    Button(
                        onClick = { viewModel.setTransferDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                        modifier = Modifier.testTag("action_transfer_btn")
                    ) {
                        Icon(Icons.Default.CompareArrows, contentDescription = "Transfer", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Transfer")
                    }
                }
            }
        }

        // Active Projects Profitability Highlights
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SectionHeader(
                    title = "Active Project Profitability",
                    subtitle = "Accrual-based revenue vs total project cost"
                )
                TextButton(onClick = onNavigateToProjects) {
                    Text("View All", color = ConstructionBlueLight)
                }
            }
        }

        items(profitabilities.take(3)) { p ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("project_profit_card_${p.projectCode}"),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = p.projectName,
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = Slate50
                            )
                            Text(
                                text = "${p.projectCode} • ${p.customerName}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Slate400
                            )
                        }
                        val marginColor = if (p.profitMarginPercent >= 20.0) EmeraldSuccess else if (p.profitMarginPercent >= 10.0) AmberWarning else RoseError
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(marginColor.copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "Margin ${"%.1f".format(p.profitMarginPercent)}%",
                                color = marginColor,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Contract Value", style = MaterialTheme.typography.labelSmall, color = Slate400)
                            Text(formatOmr(p.contractValue), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = Slate100)
                        }
                        Column {
                            Text("Total Invoiced", style = MaterialTheme.typography.labelSmall, color = Slate400)
                            Text(formatOmr(p.totalInvoiced), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = ConstructionBlueLight)
                        }
                        Column {
                            Text("Total Cost", style = MaterialTheme.typography.labelSmall, color = Slate400)
                            Text(formatOmr(p.totalCost), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = Slate300)
                        }
                        Column {
                            Text("Gross Profit", style = MaterialTheme.typography.labelSmall, color = Slate400)
                            Text(formatOmr(p.grossProfit), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = EmeraldSuccess)
                        }
                    }
                }
            }
        }

        // Recent Transactions Ledger Feed
        item {
            SectionHeader(
                title = "Recent Accounting Records",
                subtitle = "Latest posted and submitted transactions"
            )
        }

        items(uiState.transactions.take(5)) { tx ->
            TransactionItemRow(tx = tx)
        }
    }
}

@Composable
fun TransactionItemRow(tx: TransactionEntity, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("transaction_row_${tx.id}"),
        colors = CardDefaults.cardColors(containerColor = Slate900),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val (icon, iconColor) = when (tx.type) {
                com.example.data.model.TransactionType.CLIENT_INVOICE -> Pair(Icons.Default.Receipt, ConstructionBlueLight)
                com.example.data.model.TransactionType.PURCHASE -> Pair(Icons.Default.ShoppingCart, AmberWarning)
                com.example.data.model.TransactionType.DIRECT_EXPENSE -> Pair(Icons.Default.LocalGasStation, Slate400)
                com.example.data.model.TransactionType.MONEY_IN -> Pair(Icons.Default.ArrowDownward, EmeraldSuccess)
                com.example.data.model.TransactionType.MONEY_OUT -> Pair(Icons.Default.ArrowUpward, RoseError)
                com.example.data.model.TransactionType.TRANSFER -> Pair(Icons.Default.CompareArrows, PurpleAccent)
            }

            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(iconColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = icon, contentDescription = tx.type.label, tint = iconColor, modifier = Modifier.size(20.dp))
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = tx.documentRef,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Slate50
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusBadge(status = tx.status)
                }
                Text(
                    text = tx.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Slate400,
                    maxLines = 1
                )
                Text(
                    text = "${tx.date} • ${tx.projectName.ifEmpty { tx.accountName }}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Slate600
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Text(
                text = formatOmr(tx.amount),
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = Slate50
            )
        }
    }
}
