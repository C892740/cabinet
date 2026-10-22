import CabinetCore
import SwiftUI

/// Link TV — the phone side of the Smart View-style handshake: enter the code
/// shown on the TV, wait for the TV to approve, and watch the live "same
/// Wi-Fi" verdict that gates ROM auto-import.
struct PairingView: View {
    @State private var code = ""
    @State private var statusText = "Not linked yet."
    @State private var linked = false
    @State private var busy = false

    private let api = CabinetApi()

    var body: some View {
        Form {
            Section {
                TextField("123-456", text: $code)
                    .keyboardType(.numberPad)
                    .font(.system(.title2, design: .monospaced))
                Button(busy ? "Linking…" : "Link with TV") {
                    Task { await claim() }
                }
                .disabled(busy || PairGate.normalizeCode(code).count != 6)
            } header: {
                Text("Enter the code from the TV")
            } footer: {
                Text("Open Cabinet on your TV → Link a phone → enter that code here.")
            }

            Section("Status") {
                Text(statusText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if linked {
                    Button("Unlink", role: .destructive) {
                        Task { await unpair() }
                    }
                }
            }

            Section {
                Toggle("Auto-import ROMs when the TV link is verified", isOn: .constant(true))
                    .disabled(true)
            } footer: {
                Text("ROMs found in your chosen folder are added to the library automatically while this phone and the TV are on the same Wi-Fi.")
            }
        }
        .navigationTitle("Link TV")
    }

    private func claim() async {
        busy = true
        defer { busy = false }
        do {
            let pair = try await api.claim(
                code: code,
                phoneName: UIDevice.current.name,
                phoneModel: UIDevice.current.model
            )
            linked = true
            if let saved = pair["code"] as? String {
                UserDefaults.standard.set(saved, forKey: "cabinet_pair_code")
            }
            let status = pair["status"] as? String ?? "waiting"
            statusText = status == "claimed"
                ? "Code accepted — approve the link on the TV screen."
                : "Status: \(status)"
            await verifyLoop()
        } catch {
            statusText = "Could not link: \(error.localizedDescription)"
        }
    }

    /// Poll /api/pair/verify so the verdict on screen (and the import gate) stays live.
    private func verifyLoop() async {
        do {
            let result = try await api.verify(code: PairGate.normalizeCode(code))
            let gate: String
            switch result.reason {
            case "ready": gate = "✓ Same Wi-Fi — auto-import is active"
            case "different-network": gate = "⚠ Not on the same Wi-Fi — auto-import paused"
            case "tv-offline": gate = "TV not seen recently — auto-import paused"
            default: gate = "Waiting for the TV to approve the link…"
            }
            statusText = "Status: \(result.pair["status"] as? String ?? "?")\n\(gate)"
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            if linked { await verifyLoop() }
        } catch {
            statusText = "Verification failed: \(error.localizedDescription)"
        }
    }

    private func unpair() async {
        try? await api.unpair(code: PairGate.normalizeCode(code))
        UserDefaults.standard.removeObject(forKey: "cabinet_pair_code")
        linked = false
        statusText = "Unlinked."
    }
}
