package com.cabinet.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ZipProbeTest {

    /** Streaming zip (data descriptors — the case that defeats naive walkers). */
    private fun streamingZip(vararg entries: Pair<String, ByteArray>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            for ((name, bytes) in entries) {
                zip.putNextEntry(ZipEntry(name))
                zip.write(bytes)
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }

    /** Classic zip with sizes in the local headers (7-Zip/WinZip/Explorer case). */
    private fun storedZip(vararg entries: Pair<String, ByteArray>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            for ((name, bytes) in entries) {
                val entry = ZipEntry(name).apply {
                    method = ZipEntry.STORED
                    size = bytes.size.toLong()
                    compressedSize = bytes.size.toLong()
                    val crc = CRC32()
                    crc.update(bytes)
                    setCrc(crc.value)
                }
                zip.putNextEntry(entry)
                zip.write(bytes)
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }

    @Test
    fun `finds rom entry via central directory in streaming zips`() {
        val bytes = streamingZip(
            "readme.txt" to "hello".toByteArray(),
            "Pokemon Diamond.nds" to ByteArray(4096) { it.toByte() },
        )
        val found = ZipProbe.firstRomEntryName(
            ByteArrayInputStream(bytes),
            bytes.size.toLong(),
        ) { ByteArrayInputStream(bytes) }
        assertEquals("Pokemon Diamond.nds", found)
    }

    @Test
    fun `finds rom entry via local headers in stored zips`() {
        val bytes = storedZip(
            "readme.txt" to "hello".toByteArray(),
            "Pokemon - FireRed Version (USA).gba" to ByteArray(128),
        )
        val found = ZipProbe.firstRomEntryNameFromLocalHeaders(ByteArrayInputStream(bytes))
        assertEquals("Pokemon - FireRed Version (USA).gba", found)
    }

    @Test
    fun `reports null when no rom entry exists`() {
        val bytes = streamingZip("notes.txt" to "hi".toByteArray())
        val found = ZipProbe.firstRomEntryName(
            ByteArrayInputStream(bytes),
            bytes.size.toLong(),
        ) { ByteArrayInputStream(bytes) }
        assertNull(found)
    }

    @Test
    fun `reports null for garbage input`() {
        assertNull(
            ZipProbe.firstRomEntryNameFromLocalHeaders(ByteArrayInputStream(ByteArray(64) { 7 })),
        )
    }
}
