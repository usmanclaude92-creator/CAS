package com.artifysols.cas.domain.model

/** Authenticated user, mapped from Supabase auth + the app's own `profiles` table. */
data class User(
    val id: String,
    val email: String,
    val fullName: String?,
    val roleCode: String?,
    val roleName: String?,
    val permissions: List<String> = emptyList(),
) {
    val isSuperAdmin: Boolean get() = roleCode == "super_admin"

    /** Mirrors authService.hasPermission from the web app. */
    fun hasPermission(permissionCode: String): Boolean = permissions.contains(permissionCode)
}
