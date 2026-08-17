// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "SpasiBohCore",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [
        .library(name: "SpasiBohCore", targets: ["SpasiBohCore"]),
        .executable(name: "validate-content", targets: ["ValidateContent"]),
    ],
    targets: [
        .target(
            name: "SpasiBohCore",
            resources: [.copy("Resources/Content")]
        ),
        .executableTarget(
            name: "ValidateContent",
            dependencies: ["SpasiBohCore"]
        ),
        .testTarget(
            name: "SpasiBohCoreTests",
            dependencies: ["SpasiBohCore"]
        ),
    ]
)
