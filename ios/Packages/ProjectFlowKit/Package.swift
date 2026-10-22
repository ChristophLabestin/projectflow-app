// swift-tools-version: 6.2
import PackageDescription

let mainActorUI: [SwiftSetting] = [.defaultIsolation(MainActor.self)]

let package = Package(
    name: "ProjectFlowKit",
    defaultLocalization: "de",
    platforms: [.iOS("26.2")],
    products: [
        .library(name: "PFDesign", targets: ["PFDesign"]),
        .library(name: "PFModel", targets: ["PFModel"]),
        .library(name: "PFDomain", targets: ["PFDomain"]),
        .library(name: "PFData", targets: ["PFData"]),
        .library(name: "PFSnapshot", targets: ["PFSnapshot"]),
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "13.1.0"),
    ],
    targets: [
        // Value types mirroring web/types.ts. No UI, no Firebase.
        .target(name: "PFModel"),
        // Pure product logic ported from web/utils (day plan, due buckets, attention, search, capture).
        .target(name: "PFDomain", dependencies: ["PFModel"]),
        // Design tokens and the custom component library (no native controls).
        .target(name: "PFDesign", dependencies: ["PFModel"], resources: [.process("Resources")], swiftSettings: mainActorUI),
        // Compact App-Group snapshot shared with widgets, Live Activity and the share extension.
        .target(name: "PFSnapshot", dependencies: ["PFModel"]),
        // Firebase-backed repositories. App target only (never linked into extensions).
        .target(
            name: "PFData",
            dependencies: [
                "PFModel", "PFDomain", "PFSnapshot",
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFunctions", package: "firebase-ios-sdk"),
                .product(name: "FirebaseDatabase", package: "firebase-ios-sdk"),
            ],
            // Firebase's Objective-C APIs are not annotated for Sendable; Swift 5 mode keeps the
            // interop strict-concurrency findings as warnings while the module stays MainActor-isolated.
            swiftSettings: mainActorUI + [.swiftLanguageMode(.v5)]
        ),
        .testTarget(name: "PFDomainTests", dependencies: ["PFDomain", "PFModel"]),
    ]
)
