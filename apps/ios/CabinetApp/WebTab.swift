import SwiftUI
import WebKit

/// The Cabinet web app (library, player, TV mode) in a WKWebView.
struct WebTab: View {
    @State private var reloadToken = 0

    var body: some View {
        VStack(spacing: 0) {
            WebView(url: ServerConfig.serverURL, reloadToken: reloadToken)
            HStack {
                Button {
                    reloadToken += 1
                } label: {
                    Label("Reload", systemImage: "arrow.clockwise")
                }
                Spacer()
                Link(destination: ServerConfig.serverURL) {
                    Label("Open in Safari", systemImage: "safari")
                }
            }
            .font(.footnote)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }
}

private struct WebView: UIViewRepresentable {
    let url: URL
    let reloadToken: Int

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastToken != reloadToken {
            context.coordinator.lastToken = reloadToken
            webView.reload()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var lastToken = 0
    }
}
