package com.artifysols.cas.data.remote

import com.artifysols.cas.data.remote.dto.ProfileDto
import com.artifysols.cas.data.remote.dto.RoleDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.flow.Flow

class SupabaseAuthDataSource(private val client: SupabaseClient) {

    val sessionStatus: Flow<SessionStatus> get() = client.auth.sessionStatus

    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(io.github.jan.supabase.auth.providers.builtin.Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    fun currentUserId(): String? = client.auth.currentUserOrNull()?.id

    fun currentUserEmail(): String? = client.auth.currentUserOrNull()?.email

    suspend fun fetchProfile(userId: String): ProfileDto {
        return client.postgrest.from("profiles")
            .select(columns = Columns.list("id", "email", "full_name", "role_code")) {
                filter { eq("id", userId) }
            }
            .decodeSingle()
    }

    suspend fun fetchRoleName(roleCode: String): String? {
        return client.postgrest.from("roles")
            .select(columns = Columns.list("code", "name")) {
                filter { eq("code", roleCode) }
            }
            .decodeSingleOrNull<RoleDto>()
            ?.name
    }
}
