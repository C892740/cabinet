import Foundation

/// App settings: which Cabinet server this phone talks to.
enum ServerConfig {
    private static let key = "cabinet_server_url"

    /// Default matches the hosted Cabinet deployment (site.ts appUrl).
    static let defaultURL = URL(string: "https://cabinet-eta-gilt.vercel.app")!

    static var serverURL: URL {
        get {
            if let raw = UserDefaults.standard.string(forKey: key), let url = URL(string: raw) {
                return url
            }
            return defaultURL
        }
        set {
            UserDefaults.standard.set(newValue.absoluteString, forKey: key)
        }
    }
}
