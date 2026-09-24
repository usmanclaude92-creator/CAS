package com.artifysols.cas.core.designsystem.theme

import androidx.compose.ui.graphics.Color

// Brand palette matched to the web app's Tailwind tokens (blue-600/700 accent,
// slate neutrals) so the native app reads as the same product, not a
// re-skin. Source of truth: src/index.css / Tailwind defaults in the web repo.
object CasColors {
    val Blue600 = Color(0xFF2563EB)
    val Blue700 = Color(0xFF1D4ED8)
    val Blue100 = Color(0xFFDBEAFE)
    val Blue50 = Color(0xFFEFF6FF)

    val Emerald600 = Color(0xFF059669)
    val Emerald100 = Color(0xFFD1FAE5)

    val Rose600 = Color(0xFFE11D48)
    val Rose100 = Color(0xFFFFE4E6)

    val Amber600 = Color(0xFFD97706)
    val Amber100 = Color(0xFFFEF3C7)

    val Slate50 = Color(0xFFF8FAFC)
    val Slate100 = Color(0xFFF1F5F9)
    val Slate200 = Color(0xFFE2E8F0)
    val Slate300 = Color(0xFFCBD5E1)
    val Slate400 = Color(0xFF94A3B8)
    val Slate500 = Color(0xFF64748B)
    val Slate600 = Color(0xFF475569)
    val Slate700 = Color(0xFF334155)
    val Slate800 = Color(0xFF1E293B)
    val Slate900 = Color(0xFF0F172A)
    val Slate950 = Color(0xFF070C1E)

    val White = Color(0xFFFFFFFF)
}
