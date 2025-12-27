// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "tauri-plugin-screen-brightness",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "tauri-plugin-screen-brightness",
            type: .static,
            targets: ["tauri-plugin-screen-brightness"]
        )
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-screen-brightness",
            dependencies: [
                .product(name: "Tauri", package: "Tauri")
            ],
            path: "Sources"
        )
    ]
)
