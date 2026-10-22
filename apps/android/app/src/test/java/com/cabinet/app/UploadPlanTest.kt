package com.cabinet.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadPlanTest {

    @Test
    fun `chunk counts match the server contract`() {
        assertEquals(1, UploadPlan.chunkCount(1))
        assertEquals(1, UploadPlan.chunkCount(UploadPlan.CHUNK_BYTES.toLong()))
        assertEquals(2, UploadPlan.chunkCount(UploadPlan.CHUNK_BYTES.toLong() + 1))
        // A trimmed NDS dump (~50 MB) rides in ~25 chunks.
        assertEquals(25, UploadPlan.chunkCount(50_000_000))
        // At the 256 MiB maximum: chunks are 2,000,000 B, so 135 chunks.
        assertEquals(135, UploadPlan.chunkCount(UploadPlan.MAX_ROM_BYTES))
    }

    @Test
    fun `slice ranges tile the file without overlap`() {
        val size = UploadPlan.CHUNK_BYTES.toLong() * 2 + 5
        val total = UploadPlan.chunkCount(size)

        var covered = 0L
        for (index in 0 until total) {
            val range = UploadPlan.sliceRange(index, total, size)
            assertEquals(index.toLong() * UploadPlan.CHUNK_BYTES, range.first)
            covered += range.last - range.first + 1
        }
        assertEquals(size, covered)
    }

    @Test
    fun `last chunk is short but complete`() {
        val size = UploadPlan.CHUNK_BYTES.toLong() + 10
        val total = UploadPlan.chunkCount(size)
        val last = UploadPlan.sliceRange(total - 1, total, size)
        assertEquals(10L, last.last - last.first + 1)
    }

    @Test
    fun `plan validation rejects oversize and wrong totals`() {
        assertTrue(UploadPlan.isValidPlan(1024, 1))
        assertFalse(UploadPlan.isValidPlan(0, 1))
        assertFalse(UploadPlan.isValidPlan(UploadPlan.MAX_ROM_BYTES + 1, 129))
        assertFalse(UploadPlan.isValidPlan(1024, 2))
    }
}
