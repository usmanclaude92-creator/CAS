package com.artifysols.cas

import android.annotation.SuppressLint
import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(isDebuggable)

        // Serves the bundled web app over a virtual https:// origin instead of
        // a raw file:///android_asset/ load. This isn't cosmetic: the web build
        // always ships <script type="module"> (Vite's standard output, needed
        // for its code-split chunks), and Chromium-based WebView refuses to
        // execute module scripts when the page itself was loaded via file:// —
        // module fetches are treated as cross-origin under that scheme and
        // silently blocked, so React never mounts and the app renders a blank
        // white screen with nothing in the console to explain why. Routing
        // through WebViewAssetLoader's virtual https:// domain makes every
        // request behave like a normal same-origin HTTPS load, which module
        // scripts are allowed to do, while still serving the same local assets.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                // Deliberately NOT enabled: allowFileAccessFromFileURLs /
                // allowUniversalAccessFromFileURLs. With the app bundle loaded
                // from file:///android_asset/, those flags let any script
                // running in that origin read arbitrary local files and make
                // cross-origin requests with no same-origin restriction —
                // a severe local-file-exfiltration vector for a financial app.
                loadWithOverviewMode = true
                useWideViewPort = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = WebChromeClient()

            // Load the bundled offline web app through the asset loader's
            // virtual https:// origin (see assetLoader comment above). This
            // resolves to app/src/main/assets/www/index.html.
            loadUrl("https://appassets.androidplatform.net/www/index.html")
        }

        setContentView(webView)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
