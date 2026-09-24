package com.artifysols.cas

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.artifysols.cas.core.designsystem.theme.CasTheme
import com.artifysols.cas.core.navigation.CasNavGraph

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val container = (application as CasApplication).container

        setContent {
            CasTheme {
                CasNavGraph(container = container)
            }
        }
    }
}
