import Foundation

/// Upload chunking plan — the wire contract of /api/roms/[id]/rom.
/// Constants must match apps/web/src/lib/rom-sync.ts.
public enum UploadPlan {
    /// Decoded bytes per upload request (serverless body limits).
    public static let chunkBytes = 2_000_000

    /// Largest ROM Cabinet syncs (256 MiB, web parity).
    public static let maxRomBytes: Int64 = 256 * 1024 * 1024

    public static func chunkCount(sizeBytes: Int64) -> Int {
        max(1, Int((sizeBytes + Int64(chunkBytes) - 1) / Int64(chunkBytes)))
    }

    /// Byte range of chunk `index` of `total` for a file of `sizeBytes`.
    public static func sliceRange(index: Int, total: Int, sizeBytes: Int64) -> Range<Int64> {
        precondition(index >= 0 && index < total, "index \(index) out of range for \(total) chunks")
        let start = Int64(index) * Int64(chunkBytes)
        return start..<min(start + Int64(chunkBytes), sizeBytes)
    }

    public static func isValidPlan(sizeBytes: Int64, total: Int) -> Bool {
        sizeBytes >= 1 && sizeBytes <= maxRomBytes && total == chunkCount(sizeBytes: sizeBytes)
    }
}

/// Auto-import gate — mirrors apps/web/src/lib/pairing.ts canAutoImport():
/// linked + same Wi-Fi + the TV has been seen recently.
public enum PairGate {
    /// A TV counts as "present" while it heartbeats at least this often.
    public static let tvFreshMs: Int64 = 120_000

    public struct VerifyState {
        public var status: String
        public var sameNetwork: Bool
        public var tvLastSeenAt: Int64?
        public var now: Int64

        public init(status: String, sameNetwork: Bool, tvLastSeenAt: Int64?, now: Int64) {
            self.status = status
            self.sameNetwork = sameNetwork
            self.tvLastSeenAt = tvLastSeenAt
            self.now = now
        }
    }

    public struct Decision: Equatable {
        public var ok: Bool
        public var reason: String

        public init(ok: Bool, reason: String) {
            self.ok = ok
            self.reason = reason
        }
    }

    public static func decide(_ state: VerifyState) -> Decision {
        guard state.status == "linked" else { return Decision(ok: false, reason: "not-linked") }
        guard state.sameNetwork else { return Decision(ok: false, reason: "different-network") }
        guard let seen = state.tvLastSeenAt, state.now - seen <= tvFreshMs else {
            return Decision(ok: false, reason: "tv-offline")
        }
        return Decision(ok: true, reason: "ready")
    }

    /// "483291" from user input like "483-291".
    public static func normalizeCode(_ input: String) -> String {
        String(input.filter { $0.isNumber }.prefix(6))
    }

    public static func formatCode(_ code: String) -> String {
        code.count > 3 ? "\(code.prefix(3))-\(code.dropFirst(3))" : code
    }
}
