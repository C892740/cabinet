import CabinetCore
import Foundation
import WebKit

/// JSON-over-HTTP client for the Cabinet API.
///
/// Auth reuses the WKWebView cookie jar: signing in once in the embedded web
/// app also authenticates the Link TV and ROM screens. Non-browser clients
/// send no Origin header, which the server's CSRF check accepts (the desktop
/// app follows the same policy).
struct CabinetApi {

    enum ApiError: Error {
        case http(status: Int, message: String)
        case badResponse
    }

    let baseURL: URL

    init(baseURL: URL = ServerConfig.serverURL) {
        self.baseURL = baseURL
    }

    // MARK: - pairing (Smart View-style link)

    func claim(code: String, phoneName: String, phoneModel: String) async throws -> [String: Any] {
        let response = try await post("/api/pair/claim", [
            "code": PairGate.normalizeCode(code),
            "phoneName": phoneName,
            "phoneModel": phoneModel,
        ])
        return try pairState(response)
    }

    func verify(code: String) async throws -> (pair: [String: Any], canAutoImport: Bool, reason: String) {
        let response = try await post("/api/pair/verify", [
            "code": PairGate.normalizeCode(code),
            "side": "phone",
        ])
        let pair = try pairState(response)
        let status = pair["status"] as? String ?? "waiting"
        let sameNetwork = pair["sameNetwork"] as? Bool ?? false
        let tvSeen = (pair["tvLastSeenAt"] as? String).flatMap(parseIsoMillis)
        let decision = PairGate.decide(
            .init(
                status: status,
                sameNetwork: sameNetwork,
                tvLastSeenAt: tvSeen,
                now: Int64(Date().timeIntervalSince1970 * 1000)
            )
        )
        return (pair, response["canAutoImport"] as? Bool ?? decision.ok, decision.reason)
    }

    func unpair(code: String) async throws {
        _ = try await post("/api/pair/unpair", ["code": PairGate.normalizeCode(code)])
    }

    // MARK: - ROM import

    func createRom(title: String, platformSlug: String, region: String, sizeBytes: Int64, fileName: String) async throws -> String {
        let response = try await post("/api/roms", [
            "title": title,
            "platformSlug": platformSlug,
            "year": 0,
            "genre": "Imported",
            "region": region,
            "sizeMb": Double(sizeBytes) / (1024.0 * 1024.0),
            "filePath": fileName,
            "description": "Auto-imported from iPhone",
        ])
        guard let rom = response["rom"] as? [String: Any], let id = rom["id"] as? String else {
            throw ApiError.badResponse
        }
        return id
    }

    /// Chunked upload — the exact wire contract of /api/roms/[id]/rom.
    func uploadRom(romId: String, fileURL: URL, onProgress: @escaping (Int, Int) -> Void) async throws {
        let sizeBytes = try fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize.map(Int64.init) ?? 0
        guard sizeBytes > 0, sizeBytes <= UploadPlan.maxRomBytes else {
            throw ApiError.http(status: 413, message: "file size outside uploadable range")
        }
        let total = UploadPlan.chunkCount(sizeBytes: sizeBytes)

        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }

        for index in 0..<total {
            let range = UploadPlan.sliceRange(index: index, total: total, sizeBytes: sizeBytes)
            let want = Int(range.upperBound - range.lowerBound)
            let data = handle.readData(ofLength: want)
            _ = try await post("/api/roms/\(romId)/rom", [
                "index": index,
                "total": total,
                "fileName": fileURL.lastPathComponent,
                "sizeBytes": sizeBytes,
                "chunkSize": UploadPlan.chunkBytes,
                "data": data.base64EncodedString(),
            ])
            onProgress(index + 1, total)
        }
    }

    // MARK: - plumbing

    private func pairState(_ response: [String: Any]) throws -> [String: Any] {
        guard let pair = response["pair"] as? [String: Any] else { throw ApiError.badResponse }
        return pair
    }

    private func post(_ path: String, _ body: [String: Any]) async throws -> [String: Any] {
        try await send(path: path, method: "POST", body: body)
    }

    private func send(path: String, method: String, body: [String: Any]?) async throws -> [String: Any] {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw ApiError.badResponse }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        for cookie in await WKWebsiteDataStore.default().httpCookieStore.allCookies() {
            if let header = HTTPCookie.requestHeaderFields(with: [cookie])["Cookie"] {
                request.setValue(header, forHTTPHeaderField: "Cookie")
            }
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ApiError.badResponse }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(http.statusCode) else {
            throw ApiError.http(
                status: http.statusCode,
                message: (json["error"] as? String) ?? "HTTP \(http.statusCode)"
            )
        }
        return json
    }

    private func parseIsoMillis(_ value: String) -> Int64? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return Int64(date.timeIntervalSince1970 * 1000)
        }
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: value) {
            return Int64(date.timeIntervalSince1970 * 1000)
        }
        return nil
    }
}
