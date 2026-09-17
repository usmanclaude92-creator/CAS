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
import com.example.theme.*
import com.example.ui.components.formatOmr
import com.example.ui.viewmodel.CasViewModel

@Composable
fun ProjectsScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val profitabilities by viewModel.projectProfitabilities.collectAsState()
    var searchFilter by remember { mutableStateOf("") }
    var selectedStatus by remember { mutableStateOf("all") }

    val filteredProjects = profitabilities.filter { p ->
        (selectedStatus == "all" || p.projectCode.contains(selectedStatus, ignoreCase = true)) &&
                (p.projectName.contains(searchFilter, ignoreCase = true) ||
                        p.projectCode.contains(searchFilter, ignoreCase = true) ||
                        p.customerName.contains(searchFilter, ignoreCase = true))
    }

    Box(modifier = modifier.fillMaxSize().testTag("projects_screen")) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Search & Filter
            OutlinedTextField(
                value = searchFilter,
                onValueChange = { searchFilter = it },
                label = { Text("Search by Project Name, Code or Client...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                trailingIcon = {
                    if (searchFilter.isNotEmpty()) {
                        IconButton(onClick = { searchFilter = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear")
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("projects_search_input"),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ConstructionBlue,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = Slate50,
                    unfocusedTextColor = Slate100
                ),
                singleLine = true
            )

            // Projects List
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredProjects) { p ->
                    ProjectCard(
                        p = p,
                        onNewInvoice = { viewModel.setAddInvoiceDialog(true) },
                        onNewPurchase = { viewModel.setAddPurchaseDialog(true) },
                        onNewExpense = { viewModel.setAddExpenseDialog(true) }
                    )
                }
            }
        }

        // Floating Action Button for adding project
        FloatingActionButton(
            onClick = { viewModel.setAddProjectDialog(true) },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp)
                .testTag("add_project_fab"),
            containerColor = ConstructionBlue,
            contentColor = Slate50
        ) {
            Icon(Icons.Default.Add, contentDescription = "Create New Project")
        }
    }
}

@Composable
fun ProjectCard(
    p: com.example.data.model.ProjectProfitability,
    onNewInvoice: () -> Unit,
    onNewPurchase: () -> Unit,
    onNewExpense: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("project_item_${p.projectCode}"),
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
                        text = "${p.projectCode} • Client: ${p.customerName}",
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
                        text = "${"%.1f".format(p.profitMarginPercent)}% Margin",
                        color = marginColor,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Project Costing Breakdown Table
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Contract Value", style = MaterialTheme.typography.labelSmall, color = Slate400)
                    Text(formatOmr(p.contractValue), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), color = Slate100)
                }
                Column {
                    Text("Billed / Invoiced", style = MaterialTheme.typography.labelSmall, color = Slate400)
                    Text(formatOmr(p.totalInvoiced), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), color = ConstructionBlueLight)
                }
                Column {
                    Text("Total Cost", style = MaterialTheme.typography.labelSmall, color = Slate400)
                    Text(formatOmr(p.totalCost), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), color = AmberWarning)
                }
                Column {
                    Text("Gross Profit", style = MaterialTheme.typography.labelSmall, color = Slate400)
                    Text(formatOmr(p.grossProfit), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), color = EmeraldSuccess)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Receivables & Payables for this project
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Slate800)
                    .padding(10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Receivable from Client: ", style = MaterialTheme.typography.labelSmall, color = Slate400)
                    Text(formatOmr(p.totalReceivable), style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = Slate100)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Payable to Vendors: ", style = MaterialTheme.typography.labelSmall, color = Slate400)
                    Text(formatOmr(p.totalVendorPayable), style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = RoseError)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Quick project transaction triggers
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onNewInvoice,
                    modifier = Modifier.padding(end = 8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ConstructionBlueLight)
                ) {
                    Text("+ Invoice", fontSize = 12.sp)
                }
                OutlinedButton(
                    onClick = onNewPurchase,
                    modifier = Modifier.padding(end = 8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AmberWarning)
                ) {
                    Text("+ Bill", fontSize = 12.sp)
                }
                OutlinedButton(
                    onClick = onNewExpense,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300)
                ) {
                    Text("+ Expense", fontSize = 12.sp)
                }
            }
        }
    }
}
