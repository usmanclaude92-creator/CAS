package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.TransactionEntity
import com.example.data.model.TransactionType
import com.example.theme.*
import com.example.ui.components.StatusBadge
import com.example.ui.components.formatOmr
import com.example.ui.viewmodel.CasViewModel

@Composable
fun OperationsScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Client Invoices", "Vendor Bills", "Site Expenses")
    val uiState by viewModel.uiState.collectAsState()

    val currentTransactions = when (selectedTab) {
        0 -> uiState.transactions.filter { it.type == TransactionType.CLIENT_INVOICE }
        1 -> uiState.transactions.filter { it.type == TransactionType.PURCHASE }
        else -> uiState.transactions.filter { it.type == TransactionType.DIRECT_EXPENSE }
    }

    Box(modifier = modifier.fillMaxSize().testTag("operations_screen")) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Tab Selector
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Slate900,
                contentColor = ConstructionBlueLight,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .testTag("operations_tab_row")
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTab == index) Slate50 else Slate400
                            )
                        }
                    )
                }
            }

            // Operations List
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (currentTransactions.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                            colors = CardDefaults.cardColors(containerColor = Slate900)
                        ) {
                            Column(
                                modifier = Modifier.padding(32.dp).fillMaxWidth(),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(Icons.Default.Info, contentDescription = "No data", tint = Slate400, modifier = Modifier.size(32.dp))
                                Spacer(modifier = Modifier.height(10.dp))
                                Text("No records found in this category.", color = Slate400)
                            }
                        }
                    }
                } else {
                    items(currentTransactions) { tx ->
                        OperationCard(
                            tx = tx,
                            onApplyMoney = {
                                if (tx.type == TransactionType.CLIENT_INVOICE) {
                                    viewModel.setAddMoneyInDialog(true)
                                } else if (tx.type == TransactionType.PURCHASE) {
                                    viewModel.setAddMoneyOutDialog(true)
                                }
                            }
                        )
                    }
                }
            }
        }

        // Contextual FAB
        FloatingActionButton(
            onClick = {
                when (selectedTab) {
                    0 -> viewModel.setAddInvoiceDialog(true)
                    1 -> viewModel.setAddPurchaseDialog(true)
                    2 -> viewModel.setAddExpenseDialog(true)
                }
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp)
                .testTag("operations_fab"),
            containerColor = ConstructionBlue,
            contentColor = Slate50
        ) {
            Icon(Icons.Default.Add, contentDescription = "Create Record")
        }
    }
}

@Composable
fun OperationCard(
    tx: TransactionEntity,
    onApplyMoney: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("op_card_${tx.id}"),
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
                        text = "${tx.date} • ${tx.projectName}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate400
                    )
                }

                Text(
                    text = formatOmr(tx.amount),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 18.sp),
                    color = Slate50
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = tx.description,
                style = MaterialTheme.typography.bodyMedium,
                color = Slate300
            )

            if (tx.customerName.isNotEmpty() || tx.vendorName.isNotEmpty() || tx.expenseHeadName.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                val party = if (tx.customerName.isNotEmpty()) "Party: ${tx.customerName}" else if (tx.vendorName.isNotEmpty()) "Supplier: ${tx.vendorName}" else "Expense Category: ${tx.expenseHeadName}"
                Text(
                    text = party,
                    style = MaterialTheme.typography.labelSmall,
                    color = Slate400
                )
            }

            // Outstanding balance pill for invoices and purchases
            if (tx.type == TransactionType.CLIENT_INVOICE || tx.type == TransactionType.PURCHASE) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Slate800)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        val settledLabel = if (tx.type == TransactionType.CLIENT_INVOICE) "Collected" else "Paid"
                        Text(
                            text = "$settledLabel: ${formatOmr(tx.receivedOrPaidAmount)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Slate400
                        )
                        Text(
                            text = "Outstanding: ${formatOmr(tx.outstandingAmount)}",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            color = if (tx.outstandingAmount > 0) AmberWarning else EmeraldSuccess
                        )
                    }

                    if (tx.outstandingAmount > 0) {
                        Button(
                            onClick = onApplyMoney,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (tx.type == TransactionType.CLIENT_INVOICE) EmeraldSuccessBg else RoseErrorBg
                            ),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = if (tx.type == TransactionType.CLIENT_INVOICE) "Receive Money" else "Pay Bill",
                                color = if (tx.type == TransactionType.CLIENT_INVOICE) EmeraldSuccess else RoseError,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
