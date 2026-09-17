package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import com.example.data.model.UserRole
import com.example.theme.*
import com.example.ui.components.SectionHeader
import com.example.ui.viewmodel.CasViewModel

@Composable
fun MastersScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier
) {
    var selectedCategory by remember { mutableIntStateOf(0) }
    val categories = listOf("Role & Security", "Customers", "Vendors", "Accounts", "CAS Database", "Audit Trail")
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("masters_screen")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SectionHeader(
            title = "Masters & System Governance",
            subtitle = "Manage chart of accounts, parties, and audit logs"
        )

        // Subcategory bar
        ScrollableTabRow(
            selectedTabIndex = selectedCategory,
            containerColor = Slate900,
            contentColor = ConstructionBlueLight,
            edgePadding = 0.dp,
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .testTag("masters_category_row")
        ) {
            categories.forEachIndexed { index, title ->
                Tab(
                    selected = selectedCategory == index,
                    onClick = { selectedCategory = index },
                    text = {
                        Text(
                            text = title,
                            fontWeight = if (selectedCategory == index) FontWeight.Bold else FontWeight.Normal,
                            color = if (selectedCategory == index) Slate50 else Slate400,
                            fontSize = 12.sp
                        )
                    }
                )
            }
        }

        when (selectedCategory) {
            0 -> {
                // Role & Security Switcher
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("active_user_session_card"),
                            colors = CardDefaults.cardColors(containerColor = Slate900),
                            border = CardDefaults.outlinedCardBorder(),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Authenticated Session",
                                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                            color = ConstructionBlueLight
                                        )
                                        Text(
                                            text = uiState.currentUserProfile?.fullName ?: uiState.currentUserName,
                                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                            color = Slate50
                                        )
                                        Text(
                                            text = "${uiState.currentUserProfile?.email ?: "Corporate Session"} • ${uiState.currentUserProfile?.department ?: "Corporate"}",
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                            color = Slate400
                                        )
                                    }
                                    Button(
                                        onClick = { viewModel.logout() },
                                        colors = ButtonDefaults.buttonColors(containerColor = RoseError),
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                        modifier = Modifier.testTag("masters_sign_out_btn")
                                    ) {
                                        Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(14.dp), tint = androidx.compose.ui.graphics.Color.White)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Sign Out", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = androidx.compose.ui.graphics.Color.White)
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Active Security Persona", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                        Text("Switch roles to test security access controls and approval rules:", color = Slate400, style = MaterialTheme.typography.bodyMedium)
                    }

                    items(UserRole.values()) { role ->
                        val isSelected = uiState.currentUserRole == role
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.switchRole(role) }
                                .testTag("role_item_${role.name}"),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isSelected) Slate800 else Slate900
                            ),
                            border = if (isSelected) CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(ConstructionBlue)) else null,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSelected,
                                    onClick = { viewModel.switchRole(role) },
                                    colors = RadioButtonDefaults.colors(selectedColor = ConstructionBlueLight)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(role.displayName, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                    val desc = when (role) {
                                        UserRole.ADMIN -> "Full fiscal authority: create, approve, post, and reverse vouchers."
                                        UserRole.ACCOUNTANT -> "Treasury and ledger posting rights."
                                        UserRole.PROJECT_MANAGER -> "Can submit invoices and approve site subcontractor purchases."
                                        UserRole.SITE_ENGINEER -> "Site operational expense recording and daily material entry."
                                        UserRole.VIEWER -> "Read-only access to statements and project margins."
                                    }
                                    Text(desc, style = MaterialTheme.typography.bodyMedium, color = Slate400)
                                }
                            }
                        }
                    }
                }
            }
            1 -> {
                // Customers
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Client Directory (${uiState.customers.size})", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                    Button(
                        onClick = { viewModel.setNewCustomerDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Client")
                    }
                }
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(uiState.customers) { cust ->
                        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Slate900)) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(cust.name, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                Text("Code: ${cust.code} • Contact: ${cust.contactPerson}", style = MaterialTheme.typography.bodyMedium, color = Slate400)
                                Text("Phone: ${cust.phone} • Email: ${cust.email}", style = MaterialTheme.typography.labelSmall, color = Slate600)
                            }
                        }
                    }
                }
            }
            2 -> {
                // Vendors
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Supplier & Vendor Directory (${uiState.vendors.size})", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                    Button(
                        onClick = { viewModel.setNewVendorDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Vendor")
                    }
                }
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(uiState.vendors) { vend ->
                        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Slate900)) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(vend.name, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                                Text("Category: ${vend.category} • Code: ${vend.code}", style = MaterialTheme.typography.bodyMedium, color = AmberWarning)
                                Text("Contact: ${vend.contactPerson} • Phone: ${vend.phone}", style = MaterialTheme.typography.labelSmall, color = Slate400)
                            }
                        }
                    }
                }
            }
            3 -> {
                // Accounts
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Chart of Accounts (${uiState.accounts.size})", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                    Button(
                        onClick = { viewModel.setNewAccountDialog(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Account")
                    }
                }
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(uiState.accounts) { acc ->
                        AccountCard(acc = acc)
                    }
                }
            }
            4 -> {
                // CAS Database (Supabase PostgreSQL Integration)
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Slate900),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "CAS Supabase Cloud Engine",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Slate50
                                )
                                Text(
                                    text = if (uiState.isSupabaseConfigured) "LIVE CONNECTED" else "LOCAL OFFLINE",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = if (uiState.isSupabaseConfigured) EmeraldSuccess else AmberWarning
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "The application integrates with the CAS PostgreSQL database hosted on Supabase, synchronizing projects, client invoices, vendor purchases, and treasury ledgers.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Slate400
                            )
                            Spacer(modifier = Modifier.height(12.dp))

                            Text(
                                text = "Project URL: ${if (uiState.supabaseUrl.isNotEmpty()) uiState.supabaseUrl else "Not Configured (Running in Room Local DB)"}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Slate300
                            )
                            Text(
                                text = "Status: ${uiState.syncStatusMessage}",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (uiState.isSupabaseConfigured) EmeraldSuccess else Slate400
                            )

                            Spacer(modifier = Modifier.height(16.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Button(
                                    onClick = { viewModel.setSupabaseDialog(true) },
                                    colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Configure API")
                                }

                                if (uiState.isSupabaseConfigured) {
                                    OutlinedButton(
                                        onClick = { viewModel.syncDatabase() },
                                        enabled = !uiState.isSyncing,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(if (uiState.isSyncing) "Syncing..." else "Sync Now")
                                    }
                                }
                            }
                        }
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Slate900),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "PostgreSQL Schema Alignment",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = Slate50
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Mapped Tables:\n• projects (code, name, contract_value, budget_cost)\n• customers (code, name, phone, email)\n• vendors (code, name, category, phone)\n• bank_accounts & cash_accounts\n• client_invoices (IPCs with outstanding amounts)\n• purchases (bills with outstanding amounts)\n• money_in & money_out (treasury vouchers)\n• audit_logs (traceability timestamps)",
                                style = MaterialTheme.typography.bodySmall,
                                color = Slate400
                            )
                        }
                    }
                }
            }
            else -> {
                // Audit Trail
                Text("Chronological Audit Trail (${uiState.auditLogs.size})", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Slate50)
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(uiState.auditLogs) { log ->
                        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Slate900)) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(log.action, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = ConstructionBlueLight)
                                    Text(log.timestamp, style = MaterialTheme.typography.labelSmall, color = Slate600)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(log.details, style = MaterialTheme.typography.bodyMedium, color = Slate300)
                                Text("User: ${log.userName} (${log.userRole}) • Module: ${log.module}", style = MaterialTheme.typography.labelSmall, color = Slate400)
                            }
                        }
                    }
                }
            }
        }
    }
}
