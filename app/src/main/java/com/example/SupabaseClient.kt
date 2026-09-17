package com.example

import android.content.Context
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.realtime

object SupabaseConfig {
    const val DEFAULT_URL = "https://your-project.supabase.co"
    const val DEFAULT_ANON_KEY = "your-anon-key"
    const val PREFS_NAME = "cas_supabase_prefs"
    const val KEY_URL = "supabase_url"
    const val KEY_ANON_KEY = "supabase_anon_key"

    fun getStoredUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_URL, "") ?: ""
    }

    fun getStoredAnonKey(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_ANON_KEY, "") ?: ""
    }

    fun isConfigured(context: Context): Boolean {
        val url = getStoredUrl(context)
        val key = getStoredAnonKey(context)
        return url.isNotBlank() && key.isNotBlank() && url.startsWith("http") && !url.contains("your-project.supabase.co")
    }
}

fun createCasSupabaseClient(
    supabaseUrl: String = SupabaseConfig.DEFAULT_URL,
    supabaseAnonKey: String = SupabaseConfig.DEFAULT_ANON_KEY
): SupabaseClient {
    val cleanUrl = if (supabaseUrl.isBlank() || !supabaseUrl.startsWith("http")) {
        SupabaseConfig.DEFAULT_URL
    } else {
        supabaseUrl.trim().removeSuffix("/")
    }
    val cleanKey = if (supabaseAnonKey.isBlank()) SupabaseConfig.DEFAULT_ANON_KEY else supabaseAnonKey.trim()

    return createSupabaseClient(
        supabaseUrl = cleanUrl,
        supabaseKey = cleanKey
    ) {
        install(Auth)
        install(Postgrest)
        install(Realtime)
    }
}

fun getSupabaseClient(context: Context): SupabaseClient {
    val url = SupabaseConfig.getStoredUrl(context).ifBlank { SupabaseConfig.DEFAULT_URL }
    val key = SupabaseConfig.getStoredAnonKey(context).ifBlank { SupabaseConfig.DEFAULT_ANON_KEY }
    return createCasSupabaseClient(url, key)
}

val supabaseClient: SupabaseClient = createCasSupabaseClient()
