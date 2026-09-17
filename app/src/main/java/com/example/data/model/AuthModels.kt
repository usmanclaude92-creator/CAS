package com.example.data.model

data class UserProfile(
    val id: String,
    val email: String,
    val username: String,
    val fullName: String,
    val mobile: String,
    val roleId: String,
    val roleCode: String,
    val roleName: String,
    val status: String = "active", // active, inactive
    val department: String,
    val employeeId: String,
    val assignedProjectIds: List<String> = emptyList(),
    val isAllProjects: Boolean = true,
    val remarks: String = "",
    val isDemo: Boolean = false,
    val lastLogin: String = "",
    val createdAt: String = ""
) {
    fun toUserRole(): UserRole {
        return when (roleCode) {
            "super_admin" -> UserRole.ADMIN
            "accounts_manager" -> UserRole.ADMIN
            "finance_manager" -> UserRole.ADMIN
            "accountant" -> UserRole.ACCOUNTANT
            "project_accountant" -> UserRole.ACCOUNTANT
            "project_manager" -> UserRole.PROJECT_MANAGER
            "site_engineer" -> UserRole.SITE_ENGINEER
            "treasury_user" -> UserRole.ACCOUNTANT
            "viewer" -> UserRole.VIEWER
            else -> UserRole.ADMIN
        }
    }
}

data class AuthResult(
    val success: Boolean,
    val user: UserProfile? = null,
    val error: String? = null
)
