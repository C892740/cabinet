import XCTest
@testable import CabinetCore

final class RomCatalogTests: XCTestCase {

    func testPlatformFromRawRomExtensions() {
        XCTAssertEqual(RomCatalog.platform(fromFileName: "Pokemon - FireRed Version (USA).gba"), "gba")
        XCTAssertEqual(RomCatalog.platform(fromFileName: "Pokemon Diamond.nds"), "nds")
        XCTAssertEqual(RomCatalog.platform(fromFileName: "chrono trigger.smc"), "snes")
        XCTAssertEqual(RomCatalog.platform(fromFileName: "tetris.DMG"), "gb")
        XCTAssertEqual(RomCatalog.platform(fromFileName: "sonic.md"), "genesis")
        XCTAssertEqual(RomCatalog.platform(fromFileName: "mario.z64"), "n64")
    }

    func testUnknownExtensionsMapToNothing() {
        XCTAssertNil(RomCatalog.platform(fromFileName: "notes.txt"))
        XCTAssertNil(RomCatalog.platform(fromFileName: "save-state.sav"))
    }

    func testRomFileDetection() {
        XCTAssertTrue(RomCatalog.isRomFile("Pokemon Diamond.zip"))
        XCTAssertTrue(RomCatalog.isRomFile("game.NDS"))
        XCTAssertFalse(RomCatalog.isRomFile("cover.png"))
    }

    func testTitleCleanerStripsNoiseLikeTheWebApp() {
        XCTAssertEqual(
            RomCatalog.title(fromFileName: "Pokemon - FireRed Version (USA).zip"),
            "Pokemon - FireRed Version"
        )
        XCTAssertEqual(
            RomCatalog.title(fromFileName: "Kirby Super Star Ultra (Europe) (EnFrDeEsIt).zip"),
            "Kirby Super Star Ultra"
        )
        XCTAssertEqual(
            RomCatalog.title(fromFileName: "Super_Metroid_[!].sfc"),
            "Super Metroid"
        )
    }

    func testRegionTags() {
        XCTAssertEqual(RomCatalog.region(fromFileName: "Game (USA).gba"), "USA")
        XCTAssertEqual(RomCatalog.region(fromFileName: "Game (Europe) (EnFrDeEsIt).zip"), "Europe")
        XCTAssertEqual(RomCatalog.region(fromFileName: "Game (Japan).nds"), "Japan")
        XCTAssertEqual(RomCatalog.region(fromFileName: "Game (World).nes"), "World")
        XCTAssertNil(RomCatalog.region(fromFileName: "Game (Beta).nes"))
    }
}

final class UploadPlanTests: XCTestCase {

    func testChunkCountsMatchTheServerContract() {
        XCTAssertEqual(UploadPlan.chunkCount(sizeBytes: 1), 1)
        XCTAssertEqual(UploadPlan.chunkCount(sizeBytes: Int64(UploadPlan.chunkBytes)), 1)
        XCTAssertEqual(UploadPlan.chunkCount(sizeBytes: Int64(UploadPlan.chunkBytes) + 1), 2)
        // A trimmed NDS dump (~50 MB) rides in ~25 chunks.
        XCTAssertEqual(UploadPlan.chunkCount(sizeBytes: 50_000_000), 25)
        // At the 256 MiB maximum: chunks are 2,000,000 B, so 135 chunks.
        XCTAssertEqual(UploadPlan.chunkCount(sizeBytes: UploadPlan.maxRomBytes), 135)
    }

    func testSliceRangesTileTheFileWithoutOverlap() {
        let size = Int64(UploadPlan.chunkBytes) * 2 + 5
        let total = UploadPlan.chunkCount(sizeBytes: size)

        var covered: Int64 = 0
        for index in 0..<total {
            let range = UploadPlan.sliceRange(index: index, total: total, sizeBytes: size)
            XCTAssertEqual(range.lowerBound, Int64(index) * Int64(UploadPlan.chunkBytes))
            covered += range.upperBound - range.lowerBound
        }
        XCTAssertEqual(covered, size)
    }

    func testLastChunkIsShortButComplete() {
        let size = Int64(UploadPlan.chunkBytes) + 10
        let total = UploadPlan.chunkCount(sizeBytes: size)
        let last = UploadPlan.sliceRange(index: total - 1, total: total, sizeBytes: size)
        XCTAssertEqual(last.upperBound - last.lowerBound, 10)
    }

    func testPlanValidation() {
        XCTAssertTrue(UploadPlan.isValidPlan(sizeBytes: 1024, total: 1))
        XCTAssertFalse(UploadPlan.isValidPlan(sizeBytes: 0, total: 1))
        XCTAssertFalse(UploadPlan.isValidPlan(sizeBytes: UploadPlan.maxRomBytes + 1, total: 129))
        XCTAssertFalse(UploadPlan.isValidPlan(sizeBytes: 1024, total: 2))
    }
}

final class PairGateTests: XCTestCase {

    let now: Int64 = 1_700_000_000_000

    func state(
        status: String = "linked",
        sameNetwork: Bool = true,
        tvLastSeenAt: Int64? = 1_700_000_000_000 - 5_000
    ) -> PairGate.VerifyState {
        PairGate.VerifyState(status: status, sameNetwork: sameNetwork, tvLastSeenAt: tvLastSeenAt, now: now)
    }

    func testAutoImportRequiresALinkedPair() {
        let decision = PairGate.decide(state(status: "claimed"))
        XCTAssertFalse(decision.ok)
        XCTAssertEqual(decision.reason, "not-linked")
    }

    func testAutoImportRequiresTheSameWifi() {
        let decision = PairGate.decide(state(sameNetwork: false))
        XCTAssertFalse(decision.ok)
        XCTAssertEqual(decision.reason, "different-network")
    }

    func testAutoImportRequiresARecentlySeenTv() {
        let stale = PairGate.decide(state(tvLastSeenAt: now - PairGate.tvFreshMs - 1))
        XCTAssertFalse(stale.ok)
        XCTAssertEqual(stale.reason, "tv-offline")

        let missing = PairGate.decide(state(tvLastSeenAt: nil))
        XCTAssertFalse(missing.ok)
        XCTAssertEqual(missing.reason, "tv-offline")

        let fresh = PairGate.decide(state(tvLastSeenAt: now - PairGate.tvFreshMs + 1))
        XCTAssertTrue(fresh.ok)
        XCTAssertEqual(fresh.reason, "ready")
    }

    func testHappyPathOpensTheGate() {
        XCTAssertTrue(PairGate.decide(state()).ok)
    }

    func testCodeNormalizationAndFormatting() {
        XCTAssertEqual(PairGate.normalizeCode("483-291"), "483291")
        XCTAssertEqual(PairGate.normalizeCode(" 483 291 "), "483291")
        XCTAssertEqual(PairGate.normalizeCode("4832910"), "483291")
        XCTAssertEqual(PairGate.formatCode("483291"), "483-291")
        XCTAssertEqual(PairGate.formatCode("483"), "483")
    }
}
