package com.artifysols.cas.core.navigation

object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val APPROVALS = "approvals"
    const val PROJECTS = "projects"
    const val BANKING = "banking"
    const val CUSTOMERS = "customers"
    const val CUSTOMER_DETAIL = "customers/{customerId}"
    const val PURCHASES = "purchases"
    const val BUSINESS_PARTNERS = "business_partners"
    const val EXPENSES = "expenses"
    const val REPORTS = "reports"
    const val MASTERS = "masters"
    const val SYSTEM_CONFIG = "system_config"
    const val USERS = "users"
    const val ROLES = "roles"
    const val WORKFLOW_SETTINGS = "workflow_settings"
    const val MASTER_IMPORT_AUDIT = "master_import_audit"
    const val AUDIT = "audit"

    fun customerDetail(customerId: String) = "customers/$customerId"
}
