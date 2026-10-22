package com.cabinet.app

/**
 * Upload chunking plan — the wire contract of /api/roms/[id]/rom.
 * Constants must match apps/web/src/lib/rom-sync.ts.
 *
 * No Android imports: unit-tested on the JVM.
 */
object UploadPlan {
    /** Decoded bytes per upload request (serverless body limits). */
    const val CHUNK_BYTES = 2_000_000

    /** Largest ROM Cabinet syncs (256 MiB, web parity). */
    const val MAX_ROM_BYTES = 256L * 1024 * 1024

    fun chunkCount(sizeBytes: Long): Int =
        maxOf(1, ((sizeBytes + CHUNK_BYTES - 1) / CHUNK_BYTES).toInt())

    /** Byte range of chunk [index] of [total] for a file of [sizeBytes]. */
    fun sliceRange(index: Int, total: Int, sizeBytes: Long): LongRange {
        require(index in 0 until total) { "index $index out of range for $total chunks" }
        val start = index.toLong() * CHUNK_BYTES
        return start until minOf(start + CHUNK_BYTES, sizeBytes)
    }

    fun isValidPlan(sizeBytes: Long, total: Int): Boolean =
        sizeBytes in 1..MAX_ROM_BYTES && total == chunkCount(sizeBytes)
}

/**
 * Auto-import gate — mirrors apps/web/src/lib/pairing.ts canAutoImport():
 * linked + same Wi-Fi + the TV has been seen recently.
 *
 * No Android imports: unit-tested on the JVM.
 */
object PairGate {
    /** A TV counts as "present" while it heartbeats at least this often. */
    const val TV_FRESH_MS = 120_000L

    data class VerifyState(
        val status: String,
        val sameNetwork: Boolean,
        val tvLastSeenAt: Long?,
        val now: Long,
    )

    data class Decision(val ok: Boolean, val reason: String)

    fun decide(state: VerifyState): Decision = when {
        state.status != "linked" -> Decision(false, "not-linked")
        !state.sameNetwork -> Decision(false, "different-network")
        state.tvLastSeenAt == null || state.now - state.tvLastSeenAt > TV_FRESH_MS ->
            Decision(false, "tv-offline")
        else -> Decision(true, "ready")
    }

    /** "483291" from user input like "483-291". */
    fun normalizeCode(input: String): String = input.filter { it.isDigit() }.take(6)

    fun formatCode(code: String): String =
        if (code.length > 3) "${code.take(3)}-${code.substring(3)}" else code
}
