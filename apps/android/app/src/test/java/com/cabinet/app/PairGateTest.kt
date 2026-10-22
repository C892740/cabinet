package com.cabinet.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairGateTest {

    private val now = 1_700_000_000_000L

    private fun state(
        status: String = "linked",
        sameNetwork: Boolean = true,
        tvLastSeenAt: Long? = now - 5_000,
    ) = PairGate.VerifyState(status, sameNetwork, tvLastSeenAt, now)

    @Test
    fun `auto-import requires a linked pair`() {
        val decision = PairGate.decide(state(status = "claimed"))
        assertFalse(decision.ok)
        assertEquals("not-linked", decision.reason)
    }

    @Test
    fun `auto-import requires the same wifi`() {
        val decision = PairGate.decide(state(sameNetwork = false))
        assertFalse(decision.ok)
        assertEquals("different-network", decision.reason)
    }

    @Test
    fun `auto-import requires a recently seen tv`() {
        val stale = PairGate.decide(state(tvLastSeenAt = now - PairGate.TV_FRESH_MS - 1))
        assertFalse(stale.ok)
        assertEquals("tv-offline", stale.reason)

        val missing = PairGate.decide(state(tvLastSeenAt = null))
        assertFalse(missing.ok)
        assertEquals("tv-offline", missing.reason)

        val fresh = PairGate.decide(state(tvLastSeenAt = now - PairGate.TV_FRESH_MS + 1))
        assertTrue(fresh.ok)
        assertEquals("ready", fresh.reason)
    }

    @Test
    fun `happy path opens the gate`() {
        assertTrue(PairGate.decide(state()).ok)
    }

    @Test
    fun `code normalization and formatting`() {
        assertEquals("483291", PairGate.normalizeCode("483-291"))
        assertEquals("483291", PairGate.normalizeCode(" 483 291 "))
        assertEquals("483291", PairGate.normalizeCode("4832910"))
        assertEquals("483-291", PairGate.formatCode("483291"))
        assertEquals("483", PairGate.formatCode("483"))
    }
}
