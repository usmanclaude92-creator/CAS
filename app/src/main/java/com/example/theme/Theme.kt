package com.example.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// --- Material 3 Light Color Scheme (Matching Web App Light Theme) ---
val LightColorScheme = lightColorScheme(
    primary = BrandBlue600,
    onPrimary = Color.White,
    primaryContainer = BrandBlue50,
    onPrimaryContainer = BrandBlue800,
    inversePrimary = BrandBlue400,

    secondary = Slate600,
    onSecondary = Color.White,
    secondaryContainer = Slate100,
    onSecondaryContainer = Slate900,

    tertiary = Emerald600,
    onTertiary = Color.White,
    tertiaryContainer = Emerald50,
    onTertiaryContainer = Emerald800,

    background = Slate50,
    onBackground = Slate900,

    surface = Color.White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate600,
    surfaceTint = BrandBlue600,

    inverseSurface = Slate900,
    inverseOnSurface = Slate50,

    error = Rose600,
    onError = Color.White,
    errorContainer = Rose50,
    onErrorContainer = Rose800,

    outline = Slate200,
    outlineVariant = Slate100,
    scrim = Slate950
)

// --- Material 3 Dark Color Scheme (Matching Web App Dark Theme) ---
val DarkColorScheme = darkColorScheme(
    primary = ConstructionBlueLight,
    onPrimary = Slate950,
    primaryContainer = ConstructionBlueDark,
    onPrimaryContainer = BrandBlue100,
    inversePrimary = BrandBlue600,

    secondary = Slate400,
    onSecondary = Slate950,
    secondaryContainer = Slate800,
    onSecondaryContainer = Slate200,

    tertiary = Emerald400,
    onTertiary = Slate950,
    tertiaryContainer = Emerald900,
    onTertiaryContainer = Emerald100,

    background = Slate950,
    onBackground = Slate50,

    surface = Slate900,
    onSurface = Slate50,
    surfaceVariant = Slate800,
    onSurfaceVariant = Slate300,
    surfaceTint = ConstructionBlueLight,

    inverseSurface = Slate100,
    inverseOnSurface = Slate900,

    error = Rose400,
    onError = Slate950,
    errorContainer = Rose900,
    onErrorContainer = Rose100,

    outline = Slate700,
    outlineVariant = Slate800,
    scrim = Color.Black
)

/**
 * Extended semantic tokens matching the web accounting application's design system:
 * Financial indicators, audit badges, card depth borders, and table matrices.
 */
@Immutable
data class CasExtendedColors(
    val isDark: Boolean,

    // Container & Card Surfaces
    val cardBackground: Color,
    val cardBackgroundSubtle: Color,
    val cardBorder: Color,
    val topBarBackground: Color,
    val topBarContent: Color,
    val bottomNavBackground: Color,
    val bottomNavContent: Color,

    // Financial Positive (Receivables, Credits, Profit, Approved, Active Sync)
    val financialPositive: Color,
    val financialPositiveContainer: Color,
    val onFinancialPositive: Color,
    val financialPositiveBorder: Color,

    // Financial Warning (Pending Review, Approvals, Escrow, Demo Sandbox)
    val financialWarning: Color,
    val financialWarningContainer: Color,
    val onFinancialWarning: Color,
    val financialWarningBorder: Color,

    // Financial Danger (Debits, Overruns, Outflows, Rejected, Errors)
    val financialDanger: Color,
    val financialDangerContainer: Color,
    val onFinancialDanger: Color,
    val financialDangerBorder: Color,

    // Financial Neutral (Auditor, Drafts, Archived)
    val financialNeutral: Color,
    val financialNeutralContainer: Color,
    val onFinancialNeutral: Color,
    val financialNeutralBorder: Color,

    // Construction Blue Accent
    val brandAccent: Color,
    val brandAccentContainer: Color,
    val onBrandAccent: Color,

    // Financial Table & Ledger Grids
    val tableHeaderBackground: Color,
    val tableBorder: Color,
    val tableRowAlternate: Color,

    // Accounting Lifecycle Status Badges
    val badgeDraftBg: Color,
    val badgeDraftText: Color,
    val badgeSubmittedBg: Color,
    val badgeSubmittedText: Color,
    val badgeApprovedBg: Color,
    val badgeApprovedText: Color,
    val badgePostedBg: Color,
    val badgePostedText: Color,
    val badgeRejectedBg: Color,
    val badgeRejectedText: Color,
    val badgeReversedBg: Color,
    val badgeReversedText: Color
)

val LightExtendedColors = CasExtendedColors(
    isDark = false,
    cardBackground = Color.White,
    cardBackgroundSubtle = Slate50,
    cardBorder = Slate200,
    topBarBackground = Color.White,
    topBarContent = Slate900,
    bottomNavBackground = Color.White,
    bottomNavContent = Slate900,

    financialPositive = Emerald600,
    financialPositiveContainer = Emerald50,
    onFinancialPositive = Emerald800,
    financialPositiveBorder = Emerald200,

    financialWarning = Amber600,
    financialWarningContainer = Amber50,
    onFinancialWarning = Amber800,
    financialWarningBorder = Amber200,

    financialDanger = Rose600,
    financialDangerContainer = Rose50,
    onFinancialDanger = Rose800,
    financialDangerBorder = Rose200,

    financialNeutral = Slate600,
    financialNeutralContainer = Slate100,
    onFinancialNeutral = Slate800,
    financialNeutralBorder = Slate200,

    brandAccent = BrandBlue600,
    brandAccentContainer = BrandBlue50,
    onBrandAccent = BrandBlue800,

    tableHeaderBackground = Slate100,
    tableBorder = Slate200,
    tableRowAlternate = Slate50,

    badgeDraftBg = Slate100,
    badgeDraftText = Slate600,
    badgeSubmittedBg = Amber50,
    badgeSubmittedText = Amber700,
    badgeApprovedBg = Emerald50,
    badgeApprovedText = Emerald700,
    badgePostedBg = Emerald100,
    badgePostedText = Emerald800,
    badgeRejectedBg = Rose50,
    badgeRejectedText = Rose700,
    badgeReversedBg = Purple50,
    badgeReversedText = Purple700
)

val DarkExtendedColors = CasExtendedColors(
    isDark = true,
    cardBackground = Slate900,
    cardBackgroundSubtle = Slate850,
    cardBorder = Slate800,
    topBarBackground = Slate900,
    topBarContent = Slate50,
    bottomNavBackground = Slate900,
    bottomNavContent = Slate50,

    financialPositive = Emerald400,
    financialPositiveContainer = Emerald900,
    onFinancialPositive = Emerald100,
    financialPositiveBorder = Emerald800,

    financialWarning = Amber400,
    financialWarningContainer = Amber900,
    onFinancialWarning = Amber100,
    financialWarningBorder = Amber800,

    financialDanger = Rose400,
    financialDangerContainer = Rose900,
    onFinancialDanger = Rose100,
    financialDangerBorder = Rose800,

    financialNeutral = Slate400,
    financialNeutralContainer = Slate800,
    onFinancialNeutral = Slate200,
    financialNeutralBorder = Slate700,

    brandAccent = ConstructionBlueLight,
    brandAccentContainer = ConstructionBlueDark,
    onBrandAccent = Slate50,

    tableHeaderBackground = Slate800,
    tableBorder = Slate700,
    tableRowAlternate = Slate850,

    badgeDraftBg = Slate800,
    badgeDraftText = Slate400,
    badgeSubmittedBg = AmberWarningBg,
    badgeSubmittedText = AmberWarning,
    badgeApprovedBg = Color(0xFF065F46),
    badgeApprovedText = Color(0xFF34D399),
    badgePostedBg = EmeraldSuccessBg,
    badgePostedText = EmeraldSuccess,
    badgeRejectedBg = RoseErrorBg,
    badgeRejectedText = RoseError,
    badgeReversedBg = Color(0xFF4C1D95),
    badgeReversedText = PurpleAccent
)

val LocalCasExtendedColors = staticCompositionLocalOf { LightExtendedColors }

val MaterialTheme.casColors: CasExtendedColors
    @Composable
    @ReadOnlyComposable
    get() = LocalCasExtendedColors.current

@Composable
fun ConstructionAccountingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val extendedColors = if (darkTheme) DarkExtendedColors else LightExtendedColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val activity = view.context.findActivity()
            if (activity != null) {
                val window = activity.window
                val insetsController = WindowCompat.getInsetsController(window, view)
                insetsController.isAppearanceLightStatusBars = !darkTheme
                insetsController.isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    CompositionLocalProvider(
        LocalCasExtendedColors provides extendedColors
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = AppTypography,
            content = content
        )
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}


