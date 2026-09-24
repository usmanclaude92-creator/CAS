package com.artifysols.cas.core.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.GppMaybe
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Paid
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.ui.graphics.vector.ImageVector

enum class NavSection { MAIN, MASTERS, AUDIT }

data class NavDrawerItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val permission: String?,
    val section: NavSection,
)

/**
 * Mirrors Sidebar.tsx's `allNavItems` exactly — same routes, labels, order,
 * and permission codes, so the native drawer shows the same modules the web
 * sidebar does for the same role. Filtered by [com.artifysols.cas.domain.model.User.hasPermission].
 */
val navDrawerItems = listOf(
    NavDrawerItem(Routes.DASHBOARD, "Executive Dashboard", Icons.Filled.Dashboard, "dashboard.view", NavSection.MAIN),
    NavDrawerItem(Routes.APPROVALS, "Pending Approvals", Icons.Filled.Schedule, "approvals.view", NavSection.MAIN),
    NavDrawerItem(Routes.PROJECTS, "Projects & Costing", Icons.Filled.Business, "projects.view", NavSection.MAIN),
    NavDrawerItem(Routes.BANKING, "Banking & Treasury", Icons.Filled.AccountBalance, "treasury.view", NavSection.MAIN),
    NavDrawerItem(Routes.CUSTOMERS, "Clients & Receivables", Icons.Filled.Group, "customers.view", NavSection.MAIN),
    NavDrawerItem(Routes.PURCHASES, "Vendors & Payables", Icons.Filled.LocalShipping, "purchases.view", NavSection.MAIN),
    NavDrawerItem(Routes.BUSINESS_PARTNERS, "Business Partners", Icons.Filled.Handshake, "business_partners.view", NavSection.MAIN),
    NavDrawerItem(Routes.EXPENSES, "Direct Site Expenses", Icons.Filled.Paid, "expenses.view", NavSection.MAIN),
    NavDrawerItem(Routes.REPORTS, "Financial Reports", Icons.Filled.Assessment, "reports.view", NavSection.MAIN),
    NavDrawerItem(Routes.MASTERS, "Business Masters", Icons.Filled.Layers, "settings.view", NavSection.MASTERS),
    NavDrawerItem(Routes.AUDIT, "Immutable Audit Log", Icons.Filled.GppMaybe, "audit.view", NavSection.AUDIT),
)
