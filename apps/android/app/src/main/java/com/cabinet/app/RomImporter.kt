package com.cabinet.app

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import org.json.JSONObject
import java.io.InputStream

/**
 * The auto-import pipeline: for each ROM found on the phone (and only while
 * the paired TV link verifies the phone is on the same Wi-Fi), create the
 * library entry and upload the file in chunks — the same wire contract the
 * web app uses, so the TV plays it from the library with no further steps.
 */
class RomImporter(
    private val context: Context,
    private val api: Api,
    private val pairing: PairingClient,
) {
    data class ImportResult(val name: String, val state: String, val detail: String = "")

    private val prefs: SharedPreferences =
        context.getSharedPreferences("cabinet_imports", Context.MODE_PRIVATE)

    private fun importKey(entry: SafWalker.FoundRom): String = "${entry.name}|${entry.sizeBytes}"

    private fun alreadyImported(entry: SafWalker.FoundRom): Boolean =
        prefs.getStringSet("imported", emptySet())!!.contains(importKey(entry))

    private fun markImported(entry: SafWalker.FoundRom) {
        val current = prefs.getStringSet("imported", emptySet())!!.toMutableSet()
        current.add(importKey(entry))
        prefs.edit().putStringSet("imported", current).apply()
    }

    /**
     * Import every new ROM, gated on the TV link. The gate is checked before
     * the batch and re-checked every few files so a phone that leaves the
     * Wi-Fi stops importing rather than silently continuing.
     */
    fun importAll(
        entries: List<SafWalker.FoundRom>,
        pairCode: String,
        onProgress: (ImportResult) -> Unit,
    ): List<ImportResult> {
        val results = mutableListOf<ImportResult>()
        for ((index, entry) in entries.withIndex()) {
            if (alreadyImported(entry)) {
                results.add(ImportResult(entry.name, "skipped", "already in library"))
                onProgress(results.last())
                continue
            }
            if (index % 3 == 0) {
                val gate = pairing.verify(pairCode)
                if (!gate.canAutoImport) {
                    val blocked = ImportResult(entry.name, "blocked", gate.reason)
                    results.add(blocked)
                    onProgress(blocked)
                    break
                }
            }
            try {
                results.add(importOne(entry, onProgress))
            } catch (error: Exception) {
                val failed = ImportResult(entry.name, "failed", error.message ?: "upload error")
                results.add(failed)
                onProgress(failed)
            }
        }
        return results
    }

    private fun importOne(entry: SafWalker.FoundRom, onProgress: (ImportResult) -> Unit): ImportResult {
        val platform = platformFor(entry)
            ?: return ImportResult(entry.name, "skipped", "could not detect platform — add it from the Cabinet web app")
        val rom = api.post(
            "/api/roms",
            JSONObject()
                .put("title", RomCatalog.titleFromFileName(entry.name).ifEmpty { entry.name })
                .put("platformSlug", platform)
                .put("year", 0)
                .put("genre", "Imported")
                .put("region", RomCatalog.regionFromFileName(entry.name) ?: "USA")
                .put("sizeMb", entry.sizeBytes / (1024.0 * 1024.0))
                .put("filePath", entry.name)
                .put("description", "Auto-imported from phone"),
        ).getJSONObject("rom")
        val romId = rom.getString("id")

        uploadChunks(entry, romId, onProgress)
        markImported(entry)
        return ImportResult(entry.name, "imported", platform)
    }

    /** Platform slug, or null when it cannot be detected (those are skipped). */
    private fun platformFor(entry: SafWalker.FoundRom): String? {
        RomCatalog.platformFromFileName(entry.name)?.let { return it }
        if (RomCatalog.extensionOf(entry.name) == "zip") {
            val inner = openStream(entry.uri)?.use {
                ZipProbe.firstRomEntryName(it, entry.sizeBytes) { openStream(entry.uri) }
            } ?: return null
            return RomCatalog.platformFromFileName(inner)
        }
        return null
    }

    private fun uploadChunks(entry: SafWalker.FoundRom, romId: String, onProgress: (ImportResult) -> Unit) {
        val size = entry.sizeBytes
        if (size <= 0 || size > UploadPlan.MAX_ROM_BYTES) {
            throw IllegalStateException("file size ${size}B outside uploadable range")
        }
        val total = UploadPlan.chunkCount(size)
        val input = openStream(entry.uri)
            ?: throw IllegalStateException("cannot open ${entry.name}")
        input.use { stream ->
            val chunk = ByteArray(UploadPlan.CHUNK_BYTES)
            for (index in 0 until total) {
                val range = UploadPlan.sliceRange(index, total, size)
                val want = (range.last - range.first + 1).toInt()
                val data = readChunk(stream, chunk, want)
                api.post(
                    "/api/roms/$romId/rom",
                    JSONObject()
                        .put("index", index)
                        .put("total", total)
                        .put("fileName", entry.name)
                        .put("sizeBytes", size)
                        .put("chunkSize", UploadPlan.CHUNK_BYTES)
                        .put("data", android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP)),
                )
                onProgress(ImportResult(entry.name, "uploading", "${index + 1}/$total"))
            }
        }
    }

    private fun readChunk(stream: InputStream, chunk: ByteArray, want: Int): ByteArray {
        var read = 0
        while (read < want) {
            val n = stream.read(chunk, read, want - read)
            if (n < 0) break
            read += n
        }
        return if (read == want) chunk else chunk.copyOf(read)
    }

    private fun openStream(uri: Uri): InputStream? =
        context.contentResolver.openInputStream(uri)
}
