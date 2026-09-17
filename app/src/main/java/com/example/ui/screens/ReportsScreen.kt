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
import com.example.theme.*
import com.example.ui.components.SectionHeader
import com.example.ui.components.formatOmr
import com.example.ui.viewmodel.CasViewModel

@Composable
fun ReportsScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier
) {
    var selectedReportTab by remember { mutableIntStateOf(0) }
    val reportTabs = listOf("Project P&L", "Receivables", "Payables", "General Ledger")

    val profitabilities by viewModel.projectProfitabilities.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    var reverseTargetTx by remember { mutableStateOf<TransactionEntity?>(null) }
    var reverseReason by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("reports_screen")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SectionHeader(
            title = "Financial Statements & Ledgers",
            subtitle = "Certified project-wise accrual accounting reports"
        )

        // Tab Selector
        TabRow(
            selectedTabIndex = selectedReportTab,
            containerColor = Slate900,
            contentColor = ConstructionBlueLight,
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .testTag("reports_tab_row")
        ) {
            reportTabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedReportTab == index,
                    onClick = { selectedReportTab = index },
                    text = {
                        Text(
                            text = title,
                            fontWeight = if (selectedReportTab == index) FontWeight.Bold else FontWeight.Normal,
                            color = if (selectedReportTab == index) Slate50 else Slate400,
                            fontSize = 12.sp
                        )
                    }
                )
            }
        }

        when (selectedReportTab) {
            0 -> {
                // Project Profitability Statement
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(profitabilities) { p ->
                        Card(
                            modifier = Modifier.fillMaxWidth().testTag("pl_report_${p.projectCode}"),
                            colors = CardDefaults.cardColors(containerColor = Slate900),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "${p.projectName} (${p.projectCode})",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Slate50
                                )
                                Text(
                                    text = "Client: ${p.customerName}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Slate400
                                )
                                Spacer(modifier = Modifier.height(10.dp))

                                ReportRow("Contract Value:", formatOmr(p.contractValue), Slate100)
                                ReportRow("Revenue Recognized (Invoiced):", formatOmr(p.totalInvoiced), ConstructionBlueLight)
                                ReportRow("Material & Subcontract Purchases:", formatOmr(p.totalPurchases), Slate300)
                                ReportRow("Direct Site Operating Expenses:", formatOmr(p.totalExpenses), Slate300)
                                Divider(color = Slate800, thickness = 1.dp, modifier = Modifier.padding(vertical = 6.dp))
                                ReportRow("Total Direct Project Cost:", formatOmr(p.totalCost), AmberWarning)
                                val profitColor = if (p.grossProfit >= 0) EmeraldSuccess else RoseError
                                ReportRow("Gross Project Margin (OMR):", formatOmr(p.grossProfit), profitColor, isBold = true)
                                ReportRow("Operating Margin %:", "${"%.2f".format(p.profitMarginPercent)}%", profitColor, isBold = true)
                            }
                        }
                    }
                }
            }
            1 -> {
                // Client Receivables Statement
                val activeReceivables = profitabilities.filter { it.totalReceivable > 0 }
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(activeReceivables) { p ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Slate900),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(p.customerName, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                        Text(p.projectName, style = MaterialTheme.typography.bodyMedium, color = Slate400)
                                    }
                                    Text(formatOmr(p.totalReceivable), style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = AmberWarning)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Total Billed: ${formatOmr(p.totalInvoiced)}", style = MaterialTheme.typography.labelSmall, color = Slate400)
                                    Text("Collected: ${formatOmr(p.totalReceived)}", style = MaterialTheme.typography.labelSmall, color = EmeraldSuccess)
                                }
                            }
                        }
                    }
                }
            }
            2 -> {
                // Vendor Payables Statement
                val activePayables = profitabilities.filter { it.totalVendorPayable > 0 }
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(activePayables) { p ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Slate900),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Project: ${p.projectName}", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                        Text("Supplier Commitments", style = MaterialTheme.typography.bodyMedium, color = Slate400)
                                    }
                                    Text(formatOmr(p.totalVendorPayable), style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = RoseError)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Purchases Total: ${formatOmr(p.totalPurchases)}", style = MaterialTheme.typography.labelSmall, color = Slate400)
                                    Text("Disbursed: ${formatOmr(p.totalVendorPaid)}", style = MaterialTheme.typography.labelSmall, color = Slate300)
                                }
                            }
                        }
                    }
                }
            }
            else -> {
                // Full General Ledger with Reversal Option
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(uiState.transactions) { tx ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Slate900),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(tx.documentRef, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("(${tx.type.label})", style = MaterialTheme.typography.labelSmall, color = Slate400)
                                    }
                                    Text(tx.description, style = MaterialTheme.typography.bodyMedium, color = Slate300)
                                    Text("${tx.date} • ${tx.projectName.ifEmpty { tx.accountName }}", style = MaterialTheme.typography.labelSmall, color = Slate600)
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(formatOmr(tx.amount), style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                    if (tx.status == com.example.data.model.TransactionStatus.POSTED) {
                                        TextButton(
                                            onClick = {
                                                reverseTargetTx = tx
                                                reverseReason = ""
                                            },
                                            contentPadding = PaddingValues(0.dp)
                                        ) {
                                            Text("Reverse", color = RoseError, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Reversal confirmation dialog
    if (reverseTargetTx != null) {
        AlertDialog(
            onDismissRequest = { reverseTargetTx = null },
            title = { Text("Confirm Ledger Reversal") },
            text = {
                Column {
                    Text("Reversing voucher ${reverseTargetTx?.documentRef} will negate its effects on cash/treasury and mark it reversed in audit history.", color = Slate300)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = reverseReason,
                        onValueChange = { reverseReason = it },
                        label = { Text("Audit Reversal Reason (Mandatory)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        reverseTargetTx?.let { tx ->
                            viewModel.reverseTransaction(tx, reverseReason.ifEmpty { "Audit correction" })
                        }
                        reverseTargetTx = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoseError)
                ) {
                    Text("Reverse Voucher")
                }
            },
            dismissButton = {
                TextButton(onClick = { reverseTargetTx = null }) {
                    Text("Cancel", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun ReportRow(label: String, value: String, valueColor: androidx.compose.ui.graphics.Color, isBold: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = Slate400)
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal),
            color = valueColor
        )
    }
}
