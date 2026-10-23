import Foundation
import Testing

/// One golden fixture file: `{ "name", "input", "expected" }` (see `shared/fixtures/README.md`).
struct FixtureCase: Sendable, CustomTestStringConvertible {
    let url: URL
    var testDescription: String { "\(url.deletingLastPathComponent().lastPathComponent)/\(url.lastPathComponent)" }

    func data() throws -> Data { try Data(contentsOf: url) }

    private struct Envelope<I: Decodable, E: Decodable>: Decodable { let name: String; let input: I; let expected: E }

    func decode<Input: Decodable, Expected: Decodable>(_ input: Input.Type, _ expected: Expected.Type) throws -> (name: String, input: Input, expected: Expected) {
        let envelope = try JSONDecoder().decode(Envelope<Input, Expected>.self, from: data())
        return (envelope.name, envelope.input, envelope.expected)
    }

    /// Top-level keys of `expected` (to prove the Swift output type does not silently drop fields).
    func expectedKeys() throws -> Set<String> {
        guard let root = try JSONSerialization.jsonObject(with: data()) as? [String: Any],
              let expected = root["expected"] as? [String: Any] else { return [] }
        return Set(expected.keys)
    }
}

/// Resolves `<repo>/shared/fixtures/<module>/*.json` from `#filePath`. `PF_FIXTURES_DIR` overrides the
/// base (a `shared/fixtures` folder, a `shared` folder or a repo root) — handy while the fixtures
/// live in another worktree. Missing folders skip the tests instead of failing them.
enum Fixtures {
    private static let sourceFile = #filePath

    static func repoRoot(from path: String = sourceFile) -> URL {
        var url = URL(fileURLWithPath: path)
        for _ in 0..<6 { url.deleteLastPathComponent() }   // file, PFDomainTests, Tests, ProjectFlowKit, Packages, ios
        return url
    }

    static func directory(_ module: String) -> URL? {
        var bases: [URL] = []
        if let override = ProcessInfo.processInfo.environment["PF_FIXTURES_DIR"], !override.isEmpty {
            let root = URL(fileURLWithPath: override)
            bases += [root, root.appendingPathComponent("fixtures"), root.appendingPathComponent("shared/fixtures")]
        } else {
            bases.append(repoRoot().appendingPathComponent("shared/fixtures"))
        }
        for base in bases {
            let candidate = base.appendingPathComponent(module)
            var isDirectory: ObjCBool = false
            if FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory), isDirectory.boolValue { return candidate }
        }
        return nil
    }

    static func exists(_ module: String) -> Bool { directory(module) != nil }

    static func cases(_ module: String) -> [FixtureCase] {
        guard let directory = directory(module),
              let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return [] }
        return files.filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }.map(FixtureCase.init)
    }
}

/// Names the top-level fields whose values differ (Mirror based), so a failing fixture points at
/// the field instead of dumping two huge structs.
func differingFields<T>(_ actual: T, _ expected: T) -> [String] {
    var result: [String] = []
    for (left, right) in zip(Mirror(reflecting: actual).children, Mirror(reflecting: expected).children) {
        let equal = (left.value as? AnyHashable).flatMap { l in (right.value as? AnyHashable).map { l == $0 } } ?? false
        if !equal { result.append("\(left.label ?? "?"):\n    actual:   \(left.value)\n    expected: \(right.value)") }
    }
    return result
}
