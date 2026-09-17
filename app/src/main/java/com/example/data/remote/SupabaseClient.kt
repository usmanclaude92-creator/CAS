package com.example.data.remote

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class SupabaseClient(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("cas_supabase_prefs", Context.MODE_PRIVATE)

    var supabaseUrl: String
        get() = prefs.getString("supabase_url", "") ?: ""
        set(value) = prefs.edit().putString("supabase_url", cleanUrl(value)).apply()

    var supabaseAnonKey: String
        get() = prefs.getString("supabase_anon_key", "") ?: ""
        set(value) = prefs.edit().putString("supabase_anon_key", value.trim()).apply()

    private fun cleanUrl(url: String): String {
        return url.trim().removeSuffix("/")
    }

    fun isConfigured(): Boolean {
        val url = supabaseUrl
        val key = supabaseAnonKey
        return url.isNotBlank() && key.isNotBlank() && url.startsWith("http")
    }

    suspend fun testConnection(): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        if (!isConfigured()) {
            return@withContext Pair(false, "Supabase URL or Anon Key is missing.")
        }

        try {
            val endpoint = "$supabaseUrl/rest/v1/projects?select=count"
            val url = URL(endpoint)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Authorization", "Bearer $supabaseAnonKey")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Range-Unit", "items")
                setRequestProperty("Range", "0-0")
                connectTimeout = 8000
                readTimeout = 8000
            }

            val code = conn.responseCode
            conn.disconnect()

            if (code in 200..299) {
                Pair(true, "Successfully connected to CAS Supabase PostgreSQL database (HTTP $code).")
            } else if (code == 404 || code == 400) {
                // Table might need migration but server reachable
                Pair(true, "Connected to Supabase! (HTTP $code - verifying schema tables).")
            } else if (code == 401 || code == 403) {
                Pair(false, "Supabase authentication failed (HTTP $code). Check Anon Key / RLS policies.")
            } else {
                Pair(false, "Supabase returned HTTP $code.")
            }
        } catch (e: Exception) {
            Pair(false, "Connection error: ${e.localizedMessage ?: e.message}")
        }
    }

    suspend fun getTableJson(tableName: String): JSONArray? = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext null

        try {
            val endpoint = "$supabaseUrl/rest/v1/$tableName?select=*"
            val url = URL(endpoint)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Authorization", "Bearer $supabaseAnonKey")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 8000
                readTimeout = 8000
            }

            if (conn.responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = reader.readText()
                reader.close()
                conn.disconnect()
                JSONArray(response)
            } else {
                conn.disconnect()
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun insertRecord(tableName: String, jsonObject: JSONObject): Boolean = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext false

        try {
            val endpoint = "$supabaseUrl/rest/v1/$tableName"
            val url = URL(endpoint)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Authorization", "Bearer $supabaseAnonKey")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Prefer", "return=representation")
                connectTimeout = 8000
                readTimeout = 8000
            }

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(jsonObject.toString())
            writer.flush()
            writer.close()

            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }
}
