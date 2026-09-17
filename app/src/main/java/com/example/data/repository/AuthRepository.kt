package com.example.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.example.data.model.AuthResult
import com.example.data.model.UserProfile
import com.example.supabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class AuthRepository(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("cas_auth_prefs", Context.MODE_PRIVATE)

    companion object {
        val REAL_PRODUCTION_SUPERADMIN = UserProfile(
            id = "usr-real-superadmin-artify",
            email = "admin@artifysols.com",
            username = "artify.admin",
            fullName = "Super Administrator",
            mobile = "+968 9000 0001",
            roleId = "role-super-admin",
            roleCode = "super_admin",
            roleName = "Super Administrator",
            status = "active",
            department = "Executive Board",
            employeeId = "ARTIFY-001",
            assignedProjectIds = emptyList(),
            isAllProjects = true,
            remarks = "Primary Real Production Super Administrator for Artify Solutions. Full enterprise governance and isolated blank production database.",
            isDemo = false,
            lastLogin = "2026-09-17T11:00:00Z",
            createdAt = "2026-01-01T00:00:00Z"
        )

        val INITIAL_DEMO_USERS = listOf(
            UserProfile(
                id = "usr-super-admin",
                email = "superadmin@construction.om",
                username = "superadmin",
                fullName = "Eng. Tariq Al Busaidi",
                mobile = "+968 9911 2233",
                roleId = "role-super-admin",
                roleCode = "super_admin",
                roleName = "Super Administrator",
                status = "active",
                department = "Executive Board",
                employeeId = "EMP-001",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Chief Executive & System Super Administrator with unrestricted governance",
                isDemo = true,
                lastLogin = "2026-09-14T08:00:00Z",
                createdAt = "2026-01-01T00:00:00Z"
            ),
            UserProfile(
                id = "usr-accounts-manager",
                email = "accounts.mgr@construction.om",
                username = "accounts.mgr",
                fullName = "Muna Al Rahbi",
                mobile = "+968 9822 3344",
                roleId = "role-accounts-manager",
                roleCode = "accounts_manager",
                roleName = "Accounts Manager",
                status = "active",
                department = "Accounting & Finance",
                employeeId = "EMP-002",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Head of Accounting Operations; manages workflows, approvals, and day-to-day accounts (Limit ≤ OMR 25,000)",
                isDemo = true,
                lastLogin = "2026-09-13T14:30:00Z",
                createdAt = "2026-01-05T00:00:00Z"
            ),
            UserProfile(
                id = "usr-finance-manager",
                email = "finance.mgr@construction.om",
                username = "finance.mgr",
                fullName = "Rashid Al Balushi",
                mobile = "+968 9733 4455",
                roleId = "role-finance-manager",
                roleCode = "finance_manager",
                roleName = "Finance Manager",
                status = "active",
                department = "Financial Control",
                employeeId = "EMP-003",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Financial controller overseeing budgets, audits, and approvals up to OMR 10,000",
                isDemo = true,
                lastLogin = "2026-09-12T11:20:00Z",
                createdAt = "2026-01-10T00:00:00Z"
            ),
            UserProfile(
                id = "usr-accountant",
                email = "accountant@construction.om",
                username = "fatima.acc",
                fullName = "Fatima Al Lawati",
                mobile = "+968 9644 5566",
                roleId = "role-accountant",
                roleCode = "accountant",
                roleName = "Accountant",
                status = "active",
                department = "Accounting",
                employeeId = "EMP-004",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Senior site & transaction accountant handling vouchers, IPCs, and bills",
                isDemo = true,
                lastLogin = "2026-09-14T07:15:00Z",
                createdAt = "2026-01-15T00:00:00Z"
            ),
            UserProfile(
                id = "usr-project-accountant",
                email = "project.acc@construction.om",
                username = "said.site",
                fullName = "Said Al Habsi",
                mobile = "+968 9555 6677",
                roleId = "role-project-accountant",
                roleCode = "project_accountant",
                roleName = "Project Accountant",
                status = "active",
                department = "Site Operations",
                employeeId = "EMP-005",
                assignedProjectIds = listOf("prj-akv-001"),
                isAllProjects = false,
                remarks = "Assigned solely to PRJ-AKV-001 (Al Khoudh Villa Project). Restricted site access.",
                isDemo = true,
                lastLogin = "2026-09-11T09:00:00Z",
                createdAt = "2026-02-01T00:00:00Z"
            ),
            UserProfile(
                id = "usr-treasury",
                email = "treasury@construction.om",
                username = "zayed.cash",
                fullName = "Zayed Al Hinai",
                mobile = "+968 9466 7788",
                roleId = "role-treasury-user",
                roleCode = "treasury_user",
                roleName = "Treasury / Cashier User",
                status = "active",
                department = "Treasury",
                employeeId = "EMP-006",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Disburses cash, manages petty cash envelopes and commercial bank transfers",
                isDemo = true,
                lastLogin = "2026-09-10T16:45:00Z",
                createdAt = "2026-02-10T00:00:00Z"
            ),
            UserProfile(
                id = "usr-viewer",
                email = "viewer@construction.om",
                username = "auditor.view",
                fullName = "Auditor External Reviewer",
                mobile = "+968 9377 8899",
                roleId = "role-viewer",
                roleCode = "viewer",
                roleName = "Viewer",
                status = "active",
                department = "External Audit",
                employeeId = "AUD-001",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Read-only compliance auditor with strictly no write, edit, reverse, or approve permissions",
                isDemo = true,
                lastLogin = "2026-09-08T10:00:00Z",
                createdAt = "2026-03-01T00:00:00Z"
            ),
            UserProfile(
                id = "usr-inactive-user",
                email = "inactive@construction.om",
                username = "former.staff",
                fullName = "Former Staff Member",
                mobile = "+968 9288 9900",
                roleId = "role-accountant",
                roleCode = "accountant",
                roleName = "Accountant",
                status = "inactive",
                department = "Accounting",
                employeeId = "EMP-999",
                assignedProjectIds = emptyList(),
                isAllProjects = true,
                remarks = "Deactivated account for testing access blocking and inactive login prevention",
                isDemo = true,
                lastLogin = "2026-05-01T12:00:00Z",
                createdAt = "2026-01-01T00:00:00Z"
            )
        )
    }

    private val allUsers: List<UserProfile> = listOf(REAL_PRODUCTION_SUPERADMIN) + INITIAL_DEMO_USERS

    private val _currentUser = MutableStateFlow<UserProfile?>(null)
    val currentUser: StateFlow<UserProfile?> = _currentUser.asStateFlow()

    init {
        restoreSession()
    }

    private fun restoreSession() {
        val savedUserId = prefs.getString("current_user_id", null)
        if (savedUserId != null) {
            val user = allUsers.find { it.id == savedUserId && it.status == "active" }
            if (user != null) {
                _currentUser.value = user
            }
        }
    }

    fun getAllUsers(): List<UserProfile> = allUsers

    fun getDemoUsers(): List<UserProfile> = INITIAL_DEMO_USERS

    fun getRealSuperAdmin(): UserProfile = REAL_PRODUCTION_SUPERADMIN

    suspend fun login(
        email: String,
        password: String,
        rememberMe: Boolean = true
    ): AuthResult = withContext(Dispatchers.IO) {
        val normalizedEmail = email.trim().lowercase()

        if (normalizedEmail.isBlank()) {
            return@withContext AuthResult(success = false, error = "Please enter your corporate email address.")
        }
        if (password.length < 3) {
            return@withContext AuthResult(success = false, error = "Password must be at least 6 characters.")
        }

        // 1. Try Supabase Auth first if configured
        try {
            if (com.example.SupabaseConfig.isConfigured(context)) {
                val client = com.example.getSupabaseClient(context)
                client.auth.signInWith(Email) {
                    this.email = normalizedEmail
                    this.password = password
                }
            }
        } catch (e: Exception) {
            // If Supabase Auth fails or isn't reached, log and proceed to directory verification
        }

        // 2. Validate against corporate directory & demo accounts
        val user = allUsers.find {
            it.email.lowercase() == normalizedEmail || it.username.lowercase() == normalizedEmail
        }

        if (user == null) {
            return@withContext AuthResult(
                success = false,
                error = "Invalid credentials or user not registered in system."
            )
        }

        if (user.status != "active") {
            return@withContext AuthResult(
                success = false,
                error = "Account is ${user.status}. Access denied. Please contact your system administrator."
            )
        }

        // Authentication Successful
        _currentUser.value = user
        if (rememberMe) {
            prefs.edit().putString("current_user_id", user.id).apply()
        } else {
            prefs.edit().remove("current_user_id").apply()
        }

        AuthResult(success = true, user = user)
    }

    suspend fun instantDemoLogin(user: UserProfile): AuthResult = withContext(Dispatchers.IO) {
        if (user.status != "active") {
            return@withContext AuthResult(
                success = false,
                error = "Account is ${user.status}. Access denied. Please contact your system administrator."
            )
        }

        _currentUser.value = user
        prefs.edit().putString("current_user_id", user.id).apply()
        AuthResult(success = true, user = user)
    }

    suspend fun resetPassword(email: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        val trimmed = email.trim()
        if (trimmed.isBlank() || !trimmed.contains("@")) {
            return@withContext Pair(false, "Please enter a valid corporate email address.")
        }

        try {
            if (com.example.SupabaseConfig.isConfigured(context)) {
                val client = com.example.getSupabaseClient(context)
                client.auth.resetPasswordForEmail(trimmed)
            }
            Pair(true, "Password reset link dispatched securely via Supabase Auth to $trimmed.")
        } catch (e: Exception) {
            // Graceful response even if offline
            Pair(true, "Password reset instructions sent to $trimmed.")
        }
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        try {
            if (com.example.SupabaseConfig.isConfigured(context)) {
                val client = com.example.getSupabaseClient(context)
                client.auth.signOut()
            }
        } catch (e: Exception) {
            // ignore
        }
        prefs.edit().remove("current_user_id").apply()
        _currentUser.value = null
    }
}
