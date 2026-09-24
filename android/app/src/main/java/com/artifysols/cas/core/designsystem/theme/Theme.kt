package com.artifysols.cas.core.designsystem.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColors = lightColorScheme(
    primary = CasColors.Blue700,
    onPrimary = CasColors.White,
    primaryContainer = CasColors.Blue50,
    onPrimaryContainer = CasColors.Blue700,
    secondary = CasColors.Emerald600,
    onSecondary = CasColors.White,
    error = CasColors.Rose600,
    onError = CasColors.White,
    errorContainer = CasColors.Rose100,
    onErrorContainer = CasColors.Rose600,
    background = CasColors.Slate50,
    onBackground = CasColors.Slate900,
    surface = CasColors.White,
    onSurface = CasColors.Slate900,
    surfaceVariant = CasColors.Slate100,
    onSurfaceVariant = CasColors.Slate600,
    outline = CasColors.Slate300,
    outlineVariant = CasColors.Slate200,
)

private val DarkColors = darkColorScheme(
    primary = CasColors.Blue600,
    onPrimary = CasColors.White,
    primaryContainer = CasColors.Slate800,
    onPrimaryContainer = CasColors.Blue100,
    secondary = CasColors.Emerald600,
    onSecondary = CasColors.White,
    error = CasColors.Rose600,
    onError = CasColors.White,
    errorContainer = CasColors.Slate800,
    onErrorContainer = CasColors.Rose100,
    background = CasColors.Slate950,
    onBackground = CasColors.Slate100,
    surface = CasColors.Slate900,
    onSurface = CasColors.Slate100,
    surfaceVariant = CasColors.Slate800,
    onSurfaceVariant = CasColors.Slate400,
    outline = CasColors.Slate700,
    outlineVariant = CasColors.Slate800,
)

/**
 * App theme. Deliberately does NOT enable Material You dynamic color by
 * default — this is a corporate accounting product with a fixed brand
 * palette (matching the web app), not a consumer app that should reskin
 * itself per-device. Dynamic color is left wired up but off, in case that
 * product call changes later.
 */
@Composable
fun CasTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkColors
        else -> LightColors
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CasTypography,
        shapes = CasShapes,
        content = content,
    )
}
