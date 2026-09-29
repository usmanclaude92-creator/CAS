package com.artifysols.cas

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    // Holds the WebView's file-chooser callback between onShowFileChooser and
    // the system picker returning — used only by the AI Agent's attachment
    // button (Phase 4), which posts the picked file to POST /api/ai/attachments
    // exactly like any other <input type=file>. No other file access is
    // granted beyond what the user explicitly picks in this system dialog.
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Holds the WebView's mic-permission grant/deny callback between
    // onPermissionRequest and the OS runtime-permission result — used only by
    // the AI Agent's voice input (Phase 4). The web layer is never granted
    // microphone access before the user has approved the OS-level
    // RECORD_AUDIO prompt this launcher triggers.
    private var pendingAudioPermissionRequest: PermissionRequest? = null

    private val filePickerLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            val callback = filePathCallback
            filePathCallback = null
            callback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        }

    private val recordAudioPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pendingAudioPermissionRequest
            pendingAudioPermissionRequest = null
            if (request == null) return@registerForActivityResult
            if (granted) {
                request.grant(request.resources)
            } else {
                request.deny()
            }
        }

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
                mediaPlaybackRequiresUserGesture = false
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = object : WebChromeClient() {
                // AI Agent voice input (Phase 4): the web layer's
                // getUserMedia({audio:true}) call surfaces here. Only the
                // RESOURCE_AUDIO_CAPTURE case is ever granted — anything else
                // requested (camera, protected media, etc.) is denied
                // outright, since nothing in this app uses them.
                override fun onPermissionRequest(request: PermissionRequest) {
                    val wantsAudio = request.resources.any { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE }
                    if (!wantsAudio || request.resources.size != 1) {
                        request.deny()
                        return
                    }
                    val alreadyGranted = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                    if (alreadyGranted) {
                        request.grant(request.resources)
                        return
                    }
                    pendingAudioPermissionRequest = request
                    recordAudioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }

                // AI Agent attachments (Phase 4): backs the chat modal's
                // <input type=file accept="image/*,application/pdf">. Only a
                // single file may be picked, matching the web input's own
                // (non-multiple) attribute.
                override fun onShowFileChooser(
                    view: WebView,
                    callback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback
                    return try {
                        val acceptTypes = fileChooserParams.acceptTypes
                        val mimeType = acceptTypes.firstOrNull { it.isNotBlank() } ?: "*/*"
                        filePickerLauncher.launch(mimeType)
                        true
                    } catch (e: Exception) {
                        filePathCallback = null
                        false
                    }
                }
            }

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
