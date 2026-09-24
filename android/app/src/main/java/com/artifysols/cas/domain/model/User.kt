package com.artifysols.cas.domain.model

/** Authenticated user, mapped from Supabase auth + the app's own `profiles` table. */
data class User(
    val id: String,
    val email: String,
    val fullName: String?,
    val roleName: String?,
)
