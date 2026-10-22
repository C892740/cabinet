import CabinetCore
import SwiftUI
import UniformTypeIdentifiers

/// ROMs — pick the folder that holds your ROMs; Cabinet detects the games in
/// it (zipped archives included) and imports them into the shared library
/// while the paired TV link verifies the phone is on the same Wi-Fi.
struct RomScannerView: View {
    @State private var folder: URL?
    @State private var picking = false
    @State private var entries: [URL] = []
    @State private var statusText = "No folder chosen yet."
    @State private var importing = false

    private let api = CabinetApi()

    var body: some View {
        Form {
            Section {
                Button("Choose ROM folder…") {
                    picking = true
                }
                Button("Scan & import now") {
                    Task { await scanAndImport() }
                }
                .disabled(folder == nil || importing)
            } footer: {
                Text("Cabinet detects ROMs in the folder and adds them to your library — automatically, while the linked TV confirms you are on the same Wi-Fi.")
            }

            Section("Status") {
                Text(statusText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if !entries.isEmpty {
                Section("Detected (\(entries.count))") {
                    ForEach(entries, id: \.self) { url in
                        Text(url.lastPathComponent)
                            .font(.footnote)
                            .lineLimit(1)
                    }
                }
            }
        }
        .navigationTitle("ROMs")
        .fileImporter(
            isPresented: $picking,
            allowedContentTypes: [UTType.folder],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                folder = url
                statusText = "Folder chosen — scanning…"
                Task { await scanAndImport() }
            }
        }
    }

    private func scanAndImport() async {
        guard let folder else {
            statusText = "Choose a ROM folder first."
            return
        }
        let accessing = folder.startAccessingSecurityScopedResource()
        defer { if accessing { folder.stopAccessingSecurityScopedResource() } }

        statusText = "Scanning for ROMs…"
        entries = scan(folder: folder)
        statusText = "Found \(entries.count) ROM file(s)."

        guard let code = linkedPairCode() else {
            statusText = "Found \(entries.count) ROM(s). Link a TV first to auto-import."
            return
        }

        importing = true
        defer { importing = false }

        do {
            let result = try await api.verify(code: code)
            guard result.canAutoImport else {
                statusText = "Auto-import paused (\(result.reason)) — is the TV on and on the same Wi-Fi?"
                return
            }
        } catch {
            statusText = "Verification failed: \(error.localizedDescription)"
            return
        }

        var imported = 0
        for url in entries {
            do {
                try await importOne(url)
                imported += 1
                statusText = "Imported \(imported) of \(entries.count)…"
            } catch {
                statusText = "Failed on \(url.lastPathComponent): \(error.localizedDescription)"
            }
        }
        statusText = "Done — imported \(imported) of \(entries.count)."
    }

    private func scan(folder: URL) -> [URL] {
        var found: [URL] = []
        let keys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey]
        if let enumerator = FileManager.default.enumerator(
            at: folder,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles]
        ) {
            for case let url as URL in enumerator {
                guard RomCatalog.isRomFile(url.lastPathComponent) else { continue }
                found.append(url)
                if found.count >= 500 { break }
            }
        }
        return found
    }

    private func importOne(_ url: URL) async throws {
        let sizeBytes = Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        let platform = RomCatalog.platform(fromFileName: url.lastPathComponent)
            ?? "nes" // zips: the web app resolves the platform from inner names
        let romId = try await api.createRom(
            title: RomCatalog.title(fromFileName: url.lastPathComponent).isEmpty
                ? url.lastPathComponent
                : RomCatalog.title(fromFileName: url.lastPathComponent),
            platformSlug: platform,
            region: RomCatalog.region(fromFileName: url.lastPathComponent) ?? "USA",
            sizeBytes: sizeBytes,
            fileName: url.lastPathComponent
        )
        try await api.uploadRom(romId: romId, fileURL: url) { _, _ in }
    }

    private func linkedPairCode() -> String? {
        UserDefaults.standard.string(forKey: "cabinet_pair_code")
    }
}
