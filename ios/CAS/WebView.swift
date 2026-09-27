import SwiftUI
import WebKit

/// Hosts the bundled CAS web app inside a WKWebView, mirroring the
/// WebView-wrapper architecture already used by android/ instead of a
/// parallel native SwiftUI reimplementation of every screen. The web
/// bundle is copied into www/ (see the build-ios CI job) from the same
/// mobile-tailored web source android/ already builds from, so both
/// platforms ship the same UI from one codebase.
struct WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: makeConfiguration())
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            let wwwDirectory = indexURL.deletingLastPathComponent()
            webView.loadFileURL(indexURL, allowingReadAccessTo: wwwDirectory)
        } else {
            let message = "Web bundle not found in app resources (expected www/index.html)."
            webView.loadHTMLString(
                "<html><body style=\"font-family: -apple-system; padding: 24px;\">\(message)</body></html>",
                baseURL: nil
            )
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No dynamic updates needed; the web app manages its own state.
    }

    private func makeConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        return configuration
    }
}
