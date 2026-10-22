package com.cabinet.app

import java.io.InputStream

/**
 * ZIP sniffer: finds the first entry name that looks like a ROM, so a
 * "Pokemon Diamond.zip" gets the right platform without loading the archive
 * into memory.
 *
 * Two strategies:
 *  1. Walk local file headers (works when sizes are present — the common
 *     7-Zip/WinZip/Explorer case).
 *  2. When entries use data descriptors (streaming zip writers, including
 *     java.util.zip), re-read the End Of Central Directory from the tail and
 *     walk the central directory, which always carries real sizes and names.
 *
 * No Android imports: unit-tested on the JVM.
 */
object ZipProbe {

    private const val LOCAL_HEADER_SIG = 0x04034b50
    private const val CENTRAL_HEADER_SIG = 0x02014b50
    private const val EOCD_SIG = 0x06054b50
    private const val MAX_ENTRIES = 64
    private const val EOCD_TAIL_BYTES = 66_000 // EOCD + max comment

    /**
     * @param sizeBytes total archive size (needed for the tail fallback)
     * @param reopen    opens a fresh stream at offset 0 (needed for the fallback)
     */
    fun firstRomEntryName(
        input: InputStream,
        sizeBytes: Long = -1,
        reopen: (() -> InputStream?)? = null,
    ): String? {
        return firstRomEntryNameFromLocalHeaders(input)
            ?: if (sizeBytes > 0 && reopen != null) firstRomEntryNameFromCentralDirectory(sizeBytes, reopen) else null
    }

    // ── strategy 1: local file headers ──────────────────────────────────────

    fun firstRomEntryNameFromLocalHeaders(input: InputStream): String? {
        val buffer = ByteArray(30)
        var entries = 0
        while (entries < MAX_ENTRIES) {
            if (!readFully(input, buffer)) return null
            val sig = le32(buffer, 0)
            if (sig != LOCAL_HEADER_SIG) return null

            val flags = le16(buffer, 6)
            val compressedSize = le32(buffer, 18).toLong() and 0xffffffffL
            val nameLen = le16(buffer, 26)
            val extraLen = le16(buffer, 28)

            val nameBytes = ByteArray(nameLen)
            if (!readFully(input, nameBytes)) return null
            val name = String(nameBytes, Charsets.UTF_8)
            if (!readFully(input, ByteArray(extraLen))) return null

            if (RomCatalog.isRomFile(name)) return name

            // Data descriptor or unknown size → cannot find the next header.
            if ((flags and 0x08) != 0 || compressedSize <= 0) return null
            if (!skipFully(input, compressedSize)) return null
            entries += 1
        }
        return null
    }

    // ── strategy 2: end of central directory + central directory ────────────

    fun firstRomEntryNameFromCentralDirectory(sizeBytes: Long, reopen: () -> InputStream?): String? {
        val tail = reopen() ?: return null
        val eocd = tail.use { readEocd(it, sizeBytes) } ?: return null

        val central = reopen() ?: return null
        central.use { stream ->
            if (!skipFully(stream, eocd.cdOffset)) return null
            val header = ByteArray(46)
            repeat(eocd.entries) {
                if (!readFully(stream, header)) return null
                if (le32(header, 0) != CENTRAL_HEADER_SIG) return null
                val nameLen = le16(header, 28)
                val extraLen = le16(header, 30)
                val commentLen = le16(header, 32)
                val nameBytes = ByteArray(nameLen)
                if (!readFully(stream, nameBytes)) return null
                if (!skipFully(stream, (extraLen + commentLen).toLong())) return null
                val name = String(nameBytes, Charsets.UTF_8)
                if (RomCatalog.isRomFile(name)) return name
            }
        }
        return null
    }

    private data class Eocd(val entries: Int, val cdOffset: Long)

    private fun readEocd(stream: InputStream, sizeBytes: Long): Eocd? {
        val tailSize = minOf(sizeBytes, EOCD_TAIL_BYTES.toLong()).toInt()
        val tail = readTail(stream, sizeBytes, tailSize) ?: return null
        // Scan backwards for the EOCD signature.
        for (at in tail.size - 22 downTo 0) {
            if (le32(tail, at) != EOCD_SIG) continue
            val entries = le16(tail, at + 10)
            val cdOffset = le32(tail, at + 16).toLong() and 0xffffffffL
            if (entries <= 0 || cdOffset >= sizeBytes) return null
            return Eocd(entries, cdOffset)
        }
        return null
    }

    private fun readTail(stream: InputStream, sizeBytes: Long, tailSize: Int): ByteArray? {
        if (sizeBytes > 0 && !skipFully(stream, sizeBytes - tailSize)) return null
        val tail = ByteArray(tailSize)
        return if (readFully(stream, tail)) tail else null
    }

    // ── primitives ──────────────────────────────────────────────────────────

    private fun readFully(input: InputStream, target: ByteArray): Boolean {
        var read = 0
        while (read < target.size) {
            val n = input.read(target, read, target.size - read)
            if (n < 0) return false
            read += n
        }
        return true
    }

    private fun skipFully(input: InputStream, count: Long): Boolean {
        var remaining = count
        while (remaining > 0) {
            val skipped = input.skip(remaining)
            if (skipped > 0) {
                remaining -= skipped
                continue
            }
            if (input.read() < 0) return false
            remaining -= 1
        }
        return true
    }

    private fun le16(bytes: ByteArray, at: Int): Int =
        (bytes[at].toInt() and 0xff) or ((bytes[at + 1].toInt() and 0xff) shl 8)

    private fun le32(bytes: ByteArray, at: Int): Int =
        (bytes[at].toInt() and 0xff) or
            ((bytes[at + 1].toInt() and 0xff) shl 8) or
            ((bytes[at + 2].toInt() and 0xff) shl 16) or
            ((bytes[at + 3].toInt() and 0xff) shl 24)
}
