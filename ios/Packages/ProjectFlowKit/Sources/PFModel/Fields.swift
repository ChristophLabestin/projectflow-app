import Foundation

/// Tolerant reader over a Firestore document map (`[String: Any]`). PFData converts Firestore
/// `Timestamp`s to `Date` before handing maps to the model initialisers.
public struct Fields: @unchecked Sendable {
    public let raw: [String: Any]

    public init(_ raw: [String: Any]) { self.raw = raw }

    public subscript(key: String) -> Any? { raw[key] }

    public func string(_ key: String) -> String? {
        switch raw[key] {
        case let s as String: return s.isEmpty ? nil : s
        case let n as NSNumber: return n.stringValue
        default: return nil
        }
    }

    public func bool(_ key: String) -> Bool? {
        switch raw[key] {
        case let b as Bool: return b
        case let n as NSNumber: return n.boolValue
        default: return nil
        }
    }

    public func double(_ key: String) -> Double? {
        switch raw[key] {
        case let n as NSNumber: return n.doubleValue
        case let s as String: return Double(s)
        default: return nil
        }
    }

    public func int(_ key: String) -> Int? { double(key).map { Int($0) } }

    public func strings(_ key: String) -> [String] {
        switch raw[key] {
        case let list as [Any]: return list.compactMap { $0 as? String }.filter { !$0.isEmpty }
        case let s as String: return s.isEmpty ? [] : [s]
        default: return []
        }
    }

    public func date(_ key: String) -> FlexDate? { FlexDate.parse(raw[key]) }

    public func map(_ key: String) -> Fields? { (raw[key] as? [String: Any]).map(Fields.init) }

    public func maps(_ key: String) -> [Fields] {
        (raw[key] as? [Any])?.compactMap { ($0 as? [String: Any]).map(Fields.init) } ?? []
    }
}
