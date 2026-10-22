package com.cabinet.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RomCatalogTest {

    @Test
    fun `platform from raw rom extensions`() {
        assertEquals("gba", RomCatalog.platformFromFileName("Pokemon - FireRed Version (USA).gba"))
        assertEquals("nds", RomCatalog.platformFromFileName("Pokemon Diamond.nds"))
        assertEquals("snes", RomCatalog.platformFromFileName("chrono trigger.smc"))
        assertEquals("gb", RomCatalog.platformFromFileName("tetris.DMG"))
        assertEquals("genesis", RomCatalog.platformFromFileName("sonic.md"))
        assertEquals("n64", RomCatalog.platformFromFileName("mario.z64"))
    }

    @Test
    fun `unknown extensions map to nothing`() {
        assertNull(RomCatalog.platformFromFileName("notes.txt"))
        assertNull(RomCatalog.platformFromFileName("save-state.sav"))
    }

    @Test
    fun `rom file detection includes archives`() {
        assertTrue(RomCatalog.isRomFile("Pokemon Diamond.zip"))
        assertTrue(RomCatalog.isRomFile("game.NDS"))
        assertFalse(RomCatalog.isRomFile("cover.png"))
    }

    @Test
    fun `title cleaner strips noise like the web app`() {
        assertEquals(
            "Pokemon - FireRed Version",
            RomCatalog.titleFromFileName("Pokemon - FireRed Version (USA).zip"),
        )
        assertEquals(
            "Kirby Super Star Ultra",
            RomCatalog.titleFromFileName("Kirby Super Star Ultra (Europe) (EnFrDeEsIt).zip"),
        )
        assertEquals(
            "Super Metroid",
            RomCatalog.titleFromFileName("Super_Metroid_[!].sfc"),
        )
    }

    @Test
    fun `region tags`() {
        assertEquals("USA", RomCatalog.regionFromFileName("Game (USA).gba"))
        assertEquals("Europe", RomCatalog.regionFromFileName("Game (Europe) (EnFrDeEsIt).zip"))
        assertEquals("Japan", RomCatalog.regionFromFileName("Game (Japan).nds"))
        assertEquals("World", RomCatalog.regionFromFileName("Game (World).nes"))
        assertNull(RomCatalog.regionFromFileName("Game (Beta).nes"))
    }
}
