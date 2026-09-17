package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.AccountEntity
import com.example.data.model.AccountType
import com.example.data.model.TransactionType
import com.example.theme.*
import com.example.ui.components.SectionHeader
import com.example.ui.components.formatOmr
import com.example.ui.viewmodel.CasViewModel

@Composable
fun TreasuryScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val stats by viewModel.dashboardStats.collectAsState()

    val treasuryTx = uiState.transactions.filter {
        it.type in listOf(TransactionType.MONEY_IN, TransactionType.MONEY_OUT, TransactionType.TRANSFER, TransactionType.DIRECT_EXPENSE)
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("treasury_screen")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Treasury Liquidity Summary Header
        item {
            Card(
                modifier = Modifier.fillMaxWidth().testTag("treasury_summary_card"),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Total Treasury Reserves",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Slate400
                            )
                            Text(
                                text = formatOmr(stats.totalTreasuryBalance),
                                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                color = Slate50
                            )
                        }

                        Button(
                            onClick = { viewModel.setTransferDialog(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue),
                            modifier = Modifier.testTag("open_transfer_btn")
                        ) {
                            Icon(Icons.Default.CompareArrows, contentDescription = "Transfer", modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Transfer")
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { viewModel.setAddMoneyInDialog(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldSuccessBg),
                            modifier = Modifier.weight(1f).testTag("treasury_money_in_btn")
                        ) {
                            Icon(Icons.Default.ArrowDownward, contentDescription = "Deposit", tint = EmeraldSuccess, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Deposit (Money In)", color = EmeraldSuccess, fontSize = 12.sp)
                        }

                        Button(
                            onClick = { viewModel.setAddMoneyOutDialog(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = RoseErrorBg),
                            modifier = Modifier.weight(1f).testTag("treasury_money_out_btn")
                        ) {
                            Icon(Icons.Default.ArrowUpward, contentDescription = "Disburse", tint = RoseError, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Disburse (Money Out)", color = RoseError, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Active Accounts List
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SectionHeader(
                    title = "Bank & Cash Accounts",
                    subtitle = "Authorized treasury storage ledgers"
                )
                IconButton(
                    onClick = { viewModel.setNewAccountDialog(true) },
                    modifier = Modifier.testTag("add_account_btn")
                ) {
                    Icon(Icons.Default.AddCircle, contentDescription = "New Account", tint = ConstructionBlueLight)
                }
            }
        }

        items(uiState.accounts) { acc ->
            AccountCard(acc = acc)
        }

        // Recent Treasury Ledger Movements
        item {
            SectionHeader(
                title = "Treasury Inflows & Outflows",
                subtitle = "Audit log of receipts, payments, and transfers"
            )
        }

        items(treasuryTx.take(8)) { tx ->
            TransactionItemRow(tx = tx)
        }
    }
}

@Composable
fun AccountCard(acc: AccountEntity) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("account_card_${acc.id}"),
        colors = CardDefaults.cardColors(containerColor = Slate900),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val (accIcon, iconColor) = when (acc.accountType) {
                AccountType.BANK -> Pair(Icons.Default.AccountBalance, ConstructionBlueLight)
                AccountType.CASH -> Pair(Icons.Default.Savings, AmberWarning)
                AccountType.PETTY_CASH -> Pair(Icons.Default.AttachMoney, EmeraldSuccess)
            }

            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(iconColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = accIcon, contentDescription = acc.accountType.label, tint = iconColor, modifier = Modifier.size(24.dp))
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = acc.accountName,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Slate50
                )
                Text(
                    text = if (acc.accountNumber.isNotEmpty()) "${acc.bankName} • ${acc.accountNumber}" else acc.bankName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Slate400
                )
                if (acc.iban.isNotEmpty()) {
                    Text(
                        text = "IBAN: ${acc.iban}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Slate600
                    )
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatOmr(acc.currentBalance),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 18.sp),
                    color = if (acc.currentBalance >= 0) Slate50 else RoseError
                )
                Text(
                    text = acc.accountType.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = iconColor
                )
            }
        }
    }
}
