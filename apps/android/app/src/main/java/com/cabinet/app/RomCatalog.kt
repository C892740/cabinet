package com.cabinet.app

/**
 * Pure ROM naming logic — mirrors the web app's AddGameModal / metadata
 * helpers exactly, so a ROM auto-imported from the phone lands in the library
 * with the same title/platform/region as one added from the browser.
 *
 * No Android imports: unit-tested on the JVM.
 */
object RomCatalog {

    /** Unambiguous ROM extensions → Cabinet platform slugs (web parity). */
    val EXT_TO_PLATFORM: Map<String, String> = mapOf(
        "gba" to "gba",
        "agb" to "gba",
        "nds" to "nds",
        "nes" to "nes",
        "fds" to "nes",
        "unf" to "nes",
        "unif" to "nes",
        "sfc" to "snes",
        "smc" to "snes",
        "fig" to "snes",
        "swc" to "snes",
        "bs" to "snes",
        "gb" to "gb",
        "dmg" to "gb",
        "gbc" to "gb",
        "n64" to "n64",
        "z64" to "n64",
        "v64" to "n64",
        "u64" to "n64",
        "gen" to "genesis",
        "md" to "genesis",
        "smd" to "genesis",
        "gg" to "gamegear",
        "sms" to "sms",
        "a26" to "atari2600",
    )

    val ROM_EXTENSIONS: Set<String> = EXT_TO_PLATFORM.keys + setOf("zip", "7z", "rar", "iso", "bin", "cue", "chd", "pce")

    fun extensionOf(fileName: String): String =
        fileName.substringAfterLast('.', "").lowercase()

    fun isRomFile(fileName: String): Boolean = extensionOf(fileName) in ROM_EXTENSIONS

    fun platformFromFileName(fileName: String): String? =
        EXT_TO_PLATFORM[extensionOf(fileName)]

    /** Title cleaner (web parity): strip extension, tags, region parens, noise. */
    fun titleFromFileName(fileName: String): String {
        return fileName
            .replace(Regex("\\.[^.]+$"), "")
            .replace(Regex("[._]+"), " ")
            .replace(
                Regex(
                    "\\s*\\((USA|Europe|Japan|World|En[^)]*|Fr[^)]*|De[^)]*|Es[^)]*|It[^)]*|Rev[^)]*|v[^)]*|Beta|Proto[^)]*|Disc[^)]*|Track[^)]*)\\)",
                    RegexOption.IGNORE_CASE,
                ),
                "",
            )
            .replace(Regex("\\s*\\[[^\\]]*\\]"), "")
            .replace(Regex("\\s{2,}"), " ")
            .trim()
    }

    /** Region tag parser (web parity): "(USA)" etc. */
    fun regionFromFileName(fileName: String): String? {
        val match = Regex("\\((USA|Europe|Japan|World)\\)", RegexOption.IGNORE_CASE).find(fileName)
            ?: return null
        return when (match.groupValues[1].lowercase()) {
            "usa" -> "USA"
            "europe" -> "Europe"
            "japan" -> "Japan"
            else -> "World"
        }
    }
}
