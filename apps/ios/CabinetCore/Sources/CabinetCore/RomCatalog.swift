import Foundation

/// Pure ROM naming logic — mirrors the web app's AddGameModal / metadata
/// helpers (and the Android app's RomCatalog), so a ROM auto-imported from
/// the phone lands in the library with the same title/platform/region as one
/// added from the browser. No UIKit — unit-tested on Linux and macOS.
public enum RomCatalog {

    /// Unambiguous ROM extensions → Cabinet platform slugs (web parity).
    public static let extToPlatform: [String: String] = [
        "gba": "gba",
        "agb": "gba",
        "nds": "nds",
        "nes": "nes",
        "fds": "nes",
        "unf": "nes",
        "unif": "nes",
        "sfc": "snes",
        "smc": "snes",
        "fig": "snes",
        "swc": "snes",
        "bs": "snes",
        "gb": "gb",
        "dmg": "gb",
        "gbc": "gb",
        "n64": "n64",
        "z64": "n64",
        "v64": "n64",
        "u64": "n64",
        "gen": "genesis",
        "md": "genesis",
        "smd": "genesis",
        "gg": "gamegear",
        "sms": "sms",
        "a26": "atari2600",
    ]

    public static var romExtensions: Set<String> {
        Set(extToPlatform.keys).union(["zip", "7z", "rar", "iso", "bin", "cue", "chd", "pce"])
    }

    public static func extensionOf(_ fileName: String) -> String {
        (fileName as NSString).pathExtension.lowercased()
    }

    public static func isRomFile(_ fileName: String) -> Bool {
        romExtensions.contains(extensionOf(fileName))
    }

    public static func platform(fromFileName fileName: String) -> String? {
        extToPlatform[extensionOf(fileName)]
    }

    /// Title cleaner (web parity): strip extension, tags, region parens, noise.
    public static func title(fromFileName fileName: String) -> String {
        var base = fileName
        base = replace(base, pattern: #"\.[^.]+$"#, with: "") // extension
        base = replace(base, pattern: #"[._]+"#, with: " ")
        base = replace(
            base,
            pattern: #"\s*\((USA|Europe|Japan|World|En[^)]*|Fr[^)]*|De[^)]*|Es[^)]*|It[^)]*|Rev[^)]*|v[^)]*|Beta|Proto[^)]*|Disc[^)]*|Track[^)]*)\)"#,
            with: "",
            caseInsensitive: true
        )
        base = replace(base, pattern: #"\s*\[[^\]]*\]"#, with: "")
        base = replace(base, pattern: #"\s{2,}"#, with: " ")
        return base.trimmingCharacters(in: .whitespaces)
    }

    /// Region tag parser (web parity): "(USA)" etc.
    public static func region(fromFileName fileName: String) -> String? {
        guard let match = firstMatch(
            fileName,
            pattern: #"\((USA|Europe|Japan|World)\)"#,
            caseInsensitive: true
        ) else { return nil }
        switch match.lowercased() {
        case "usa": return "USA"
        case "europe": return "Europe"
        case "japan": return "Japan"
        default: return "World"
        }
    }

    // MARK: - tiny regex helpers (NSRegularExpression works on Linux)

    private static func replace(
        _ input: String,
        pattern: String,
        with template: String,
        caseInsensitive: Bool = false
    ) -> String {
        var options: NSRegularExpression.Options = []
        if caseInsensitive { options.insert(.caseInsensitive) }
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else {
            return input
        }
        let range = NSRange(input.startIndex..<input.endIndex, in: input)
        return regex.stringByReplacingMatches(in: input, options: [], range: range, withTemplate: template)
    }

    private static func firstMatch(
        _ input: String,
        pattern: String,
        caseInsensitive: Bool = false
    ) -> String? {
        var options: NSRegularExpression.Options = []
        if caseInsensitive { options.insert(.caseInsensitive) }
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else {
            return nil
        }
        let range = NSRange(input.startIndex..<input.endIndex, in: input)
        guard let match = regex.firstMatch(in: input, options: [], range: range),
              let swiftRange = Range(match.range(at: 1), in: input) else { return nil }
        return String(input[swiftRange])
    }
}
