package com.artifysols.cas

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ContentValues
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var pendingFileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var isDebugBuild = false
    private var hasShownJsErrorDialog = false

    private val backCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            webView.goBack()
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = pendingFileChooserCallback
        pendingFileChooserCallback = null
        val data = result.data
        val uris = when {
            callback == null || result.resultCode != RESULT_OK || data == null -> null
            data.clipData != null -> Array(data.clipData!!.itemCount) { i -> data.clipData!!.getItemAt(i).uri }
            data.data != null -> arrayOf(data.data!!)
            else -> null
        }
        callback?.onReceiveValue(uris)
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            Toast.makeText(this, "Storage permission is needed to save downloads", Toast.LENGTH_LONG).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)

        isDebugBuild = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(isDebugBuild)

        // Serves the bundled web app over a virtual https:// origin instead of
        // file:///android_asset/. Vite's build unconditionally marks <script
        // type="module"> and its stylesheet <link> as crossorigin, which forces
        // a CORS-mode fetch — and Chromium's CORS fetch only allows the chrome,
        // chrome-untrusted, data, http and https schemes, so those requests are
        // blocked outright under file://, leaving a blank page. appassets is
        // Google's documented fix for this exact class of WebView issue.
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                // Deliberately NOT enabled: allowFileAccessFromFileURLs /
                // allowUniversalAccessFromFileURLs. The app bundle loads over
                // the virtual https://appassets.androidplatform.net origin
                // (see assetLoader below), not file://, so these aren't needed
                // — leaving them off keeps any script from reading arbitrary
                // local files or making cross-origin requests with no
                // same-origin restriction, a severe exfiltration vector for a
                // financial app.
                loadWithOverviewMode = true
                useWideViewPort = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    backCallback.isEnabled = view.canGoBack()
                    if (isDebugBuild) checkAppMounted(view)
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {
                    super.onReceivedError(view, request, error)
                    if (request.isForMainFrame) {
                        view.loadDataWithBaseURL(null, OFFLINE_HTML, "text/html", "utf-8", null)
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    if (filePathCallback == null || fileChooserParams == null) return false
                    pendingFileChooserCallback?.onReceiveValue(null)
                    pendingFileChooserCallback = filePathCallback
                    return try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (e: Exception) {
                        pendingFileChooserCallback = null
                        false
                    }
                }

                // Debug builds only: surfaces WebView JS console errors as an
                // on-screen dialog, since there's no way to reach chrome://inspect
                // without a USB-connected computer.
                override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                    Log.e("CAS-WebView", "${consoleMessage.message()} (${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})")
                    if (isDebugBuild && consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        showDiagnosticDialog(
                            "JavaScript error",
                            "${consoleMessage.message()}\n\nat ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}"
                        )
                    }
                    return false
                }
            }

            setDownloadListener { url, _, contentDisposition, mimeType, _ ->
                handleDownload(url, contentDisposition, mimeType)
            }

            // Bridges blob: URL downloads (jsPDF / SheetJS exports, see
            // saveBlobUri below) back into native code — safe here because the
            // app only ever loads its own bundled assets plus Supabase XHR
            // responses, never arbitrary/untrusted pages.
            addJavascriptInterface(DownloadBridge(), "AndroidDownloadBridge")

            // Load bundled assets over the virtual appassets origin (see
            // assetLoader above) rather than file:///android_asset/.
            loadUrl(APP_URL)
        }

        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        setContentView(webView)
        onBackPressedDispatcher.addCallback(this, backCallback)
    }

    // Debug builds only: 2.5s after the page finishes loading, checks whether
    // anything actually rendered into #root. Catches failures (e.g. a JS
    // error that fires before any console.error, or a missing asset) that
    // leave a blank page without ever calling onConsoleMessage or
    // onReceivedError.
    private fun checkAppMounted(view: WebView) {
        view.postDelayed({
            view.evaluateJavascript(
                "document.getElementById('root') ? document.getElementById('root').children.length : -1;"
            ) { result ->
                if (result?.toIntOrNull() == 0) {
                    showDiagnosticDialog(
                        "Blank page detected",
                        "$APP_URL finished loading but nothing rendered into #root after 2.5s. " +
                            "This usually means a JS error occurred with no console.error logged, " +
                            "or a required asset (JS/CSS bundle) failed to load."
                    )
                }
            }
        }, 2500)
    }

    private fun showDiagnosticDialog(title: String, message: String) {
        if (hasShownJsErrorDialog || isFinishing) return
        hasShownJsErrorDialog = true
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .setCancelable(true)
            .show()
    }

    private fun handleDownload(url: String, contentDisposition: String?, mimeType: String?) {
        val resolvedMime = mimeType?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
        val filename = URLUtil.guessFileName(url, contentDisposition, resolvedMime)
        when {
            url.startsWith("data:") -> saveDataUri(url, filename, resolvedMime)
            url.startsWith("blob:") -> saveBlobUri(url, filename, resolvedMime)
            else -> downloadHttpUrl(url, filename, resolvedMime)
        }
    }

    private fun saveDataUri(dataUri: String, filename: String, mimeType: String) {
        val base64 = dataUri.substringAfter("base64,", missingDelimiterValue = "")
        if (base64.isEmpty()) {
            Toast.makeText(this, "Unable to save $filename", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            saveBytes(Base64.decode(base64, Base64.DEFAULT), filename, mimeType)
        } catch (e: IllegalArgumentException) {
            Toast.makeText(this, "Unable to save $filename", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveBlobUri(blobUrl: String, filename: String, mimeType: String) {
        val js = """
            (function() {
                fetch(${JSONObject.quote(blobUrl)})
                    .then(function(res) { return res.blob(); })
                    .then(function(blob) {
                        var reader = new FileReader();
                        reader.onloadend = function() {
                            var base64 = String(reader.result).split(',')[1];
                            AndroidDownloadBridge.onBlobData(base64, ${JSONObject.quote(filename)}, ${JSONObject.quote(mimeType)});
                        };
                        reader.readAsDataURL(blob);
                    });
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun downloadHttpUrl(url: String, filename: String, mimeType: String) {
        if (!hasLegacyStoragePermission()) {
            requestLegacyStoragePermissionAndNotify(filename)
            return
        }
        try {
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                addRequestHeader("User-Agent", webView.settings.userAgentString)
                setMimeType(mimeType)
                setTitle(filename)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            Toast.makeText(this, "Downloading $filename", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Unable to download $filename", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveBytes(bytes: ByteArray, filename: String, mimeType: String) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("MediaStore insert failed")
                resolver.openOutputStream(uri)?.use { it.write(bytes) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } else {
                if (!hasLegacyStoragePermission()) {
                    requestLegacyStoragePermissionAndNotify(filename)
                    return
                }
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val file = File(downloadsDir, filename)
                FileOutputStream(file).use { it.write(bytes) }
                MediaScannerConnection.scanFile(this, arrayOf(file.absolutePath), arrayOf(mimeType), null)
            }
            Toast.makeText(this, "Saved $filename to Downloads", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Unable to save $filename", Toast.LENGTH_SHORT).show()
        }
    }

    private fun hasLegacyStoragePermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
            PackageManager.PERMISSION_GRANTED

    private fun requestLegacyStoragePermissionAndNotify(filename: String) {
        storagePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        Toast.makeText(this, "Grant storage permission, then retry downloading $filename", Toast.LENGTH_LONG).show()
    }

    private inner class DownloadBridge {
        @JavascriptInterface
        fun onBlobData(base64: String, filename: String, mimeType: String) {
            runOnUiThread {
                try {
                    saveBytes(Base64.decode(base64, Base64.DEFAULT), filename, mimeType)
                } catch (e: IllegalArgumentException) {
                    Toast.makeText(this@MainActivity, "Unable to save $filename", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private companion object {
        // Served by WebViewAssetLoader (registered in onCreate), which maps
        // /assets/ under this virtual https origin back to the app's real
        // assets/ folder — i.e. this resolves to android_asset/www/index.html.
        const val APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"

        val OFFLINE_HTML = """
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <style>
                body { background:#070c1e; color:#ffffff; font-family:sans-serif; display:flex;
                       flex-direction:column; align-items:center; justify-content:center;
                       height:100vh; margin:0; text-align:center; padding:24px; box-sizing:border-box; }
                h1 { font-size:20px; margin-bottom:8px; }
                p { color:#9aa5c7; margin-bottom:24px; }
                a { background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px;
                    text-decoration:none; font-weight:600; }
              </style>
            </head>
            <body>
              <h1>You're offline</h1>
              <p>Check your internet connection and try again.</p>
              <a href="$APP_URL">Retry</a>
            </body>
            </html>
        """.trimIndent()
    }
}
