package com.artifysols.cas.core.network

import android.content.Context
import com.artifysols.cas.BuildConfig
import com.artifysols.cas.core.security.EncryptedSessionManager
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

/**
 * Single Supabase client for the whole app, pointed at the same project the
 * web app uses. Auth requests carry the user's real JWT on every Postgrest
 * call, so every query below is subject to the exact same row-level-security
 * policies as the web client — there is no separate/looser "mobile API".
 */
object SupabaseClientProvider {

    @Volatile
    private var client: SupabaseClient? = null

    fun get(context: Context): SupabaseClient {
        return client ?: synchronized(this) {
            client ?: buildClient(context.applicationContext).also { client = it }
        }
    }

    private fun buildClient(context: Context): SupabaseClient {
        check(BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()) {
            "SUPABASE_URL / SUPABASE_ANON_KEY were not injected at build time. " +
                "Set them as Gradle properties or environment variables (see app/build.gradle.kts)."
        }
        return createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            install(Auth) {
                sessionManager = EncryptedSessionManager(context)
                alwaysAutoRefresh = true
                autoLoadFromStorage = true
            }
            install(Postgrest)
        }
    }
}
