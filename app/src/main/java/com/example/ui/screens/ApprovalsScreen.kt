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
import com.example.data.model.TransactionStatus
import com.example.data.model.UserRole
import com.example.theme.*
import com.example.ui.components.SectionHeader
import com.example.ui.components.StatusBadge
import com.example.ui.components.formatOmr
import com.example.ui.viewmodel.CasViewModel

@Composable
fun ApprovalsScreen(
    viewModel: CasViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    var rejectionTargetTx by remember { mutableStateOf<TransactionEntity?>(null) }
    var rejectionReason by remember { mutableStateOf("") }

    val pendingApprovals = uiState.transactions.filter {
        it.status == TransactionStatus.SUBMITTED || it.status == TransactionStatus.APPROVED
    }

    val canApprove = uiState.currentUserRole == UserRole.ADMIN || uiState.currentUserRole == UserRole.ACCOUNTANT

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("approvals_screen")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Role Permission Banner
        Card(
            modifier = Modifier.fillMaxWidth().testTag("approvals_permission_banner"),
            colors = CardDefaults.cardColors(containerColor = Slate900),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (canApprove) Icons.Default.VerifiedUser else Icons.Default.Lock,
                    contentDescription = "Permission Status",
                    tint = if (canApprove) EmeraldSuccess else AmberWarning,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (canApprove) "Approval Authority Granted" else "View-Only Mode",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Slate50
                    )
                    Text(
                        text = if (canApprove)
                            "You are logged in as ${uiState.currentUserName} with full fiscal authorization."
                        else
                            "Only CFO or Chief Accountant roles can approve or post ledger vouchers.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate400
                    )
                }
            }
        }

        SectionHeader(
            title = "Workflow Approval Queue (${pendingApprovals.size})",
            subtitle = "Verify site documents, POs, and subcontracts before ledger posting"
        )

        if (pendingApprovals.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                colors = CardDefaults.cardColors(containerColor = Slate900)
            ) {
                Column(
                    modifier = Modifier.padding(36.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = "All clean", tint = EmeraldSuccess, modifier = Modifier.size(40.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Approval Queue is Clean",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Slate50
                    )
                    Text("All invoices, bills, and expenses are posted.", color = Slate400)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(pendingApprovals) { tx ->
                    ApprovalItemCard(
                        tx = tx,
                        canApprove = canApprove,
                        onApprove = { viewModel.approveTransaction(tx) },
                        onPost = { viewModel.postTransaction(tx) },
                        onReject = {
                            rejectionTargetTx = tx
                            rejectionReason = ""
                        }
                    )
                }
            }
        }
    }

    // Rejection Dialog
    if (rejectionTargetTx != null) {
        AlertDialog(
            onDismissRequest = { rejectionTargetTx = null },
            title = { Text("Reject Transaction") },
            text = {
                Column {
                    Text("Specify reason for rejecting document ${rejectionTargetTx?.documentRef}:", color = Slate300)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = rejectionReason,
                        onValueChange = { rejectionReason = it },
                        label = { Text("Rejection reason") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = false
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        rejectionTargetTx?.let { tx ->
                            viewModel.rejectTransaction(tx, rejectionReason.ifEmpty { "Disapproved by auditor." })
                        }
                        rejectionTargetTx = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoseError)
                ) {
                    Text("Confirm Reject")
                }
            },
            dismissButton = {
                TextButton(onClick = { rejectionTargetTx = null }) {
                    Text("Cancel", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun ApprovalItemCard(
    tx: TransactionEntity,
    canApprove: Boolean,
    onApprove: () -> Unit,
    onPost: () -> Unit,
    onReject: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("approval_card_${tx.id}"),
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
                        text = "${tx.type.label} • ${tx.projectName}",
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

            Spacer(modifier = Modifier.height(8.dp))
            Text(text = tx.description, style = MaterialTheme.typography.bodyMedium, color = Slate300)
            Text(
                text = "Submitted by: ${tx.createdBy} on ${tx.date}",
                style = MaterialTheme.typography.labelSmall,
                color = Slate600
            )

            if (canApprove) {
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = onReject,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = RoseError),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Reject", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Reject", fontSize = 12.sp)
                    }

                    if (tx.status == TransactionStatus.SUBMITTED) {
                        Button(
                            onClick = onApprove,
                            colors = ButtonDefaults.buttonColors(containerColor = ConstructionBlue),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = "Approve", modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Approve", fontSize = 12.sp)
                        }
                    }

                    Button(
                        onClick = onPost,
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldSuccess)
                    ) {
                        Icon(Icons.Default.Publish, contentDescription = "Post", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Post to Ledger", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
