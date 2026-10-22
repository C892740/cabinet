// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CabinetCore",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(name: "CabinetCore", targets: ["CabinetCore"]),
    ],
    targets: [
        .target(name: "CabinetCore"),
        .testTarget(name: "CabinetCoreTests", dependencies: ["CabinetCore"]),
    ]
)
