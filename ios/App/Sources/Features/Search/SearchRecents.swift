import Foundation
import Observation

/// An item the user opened from search or the results (shown under "Zuletzt geöffnet").
struct SearchRecentItem: Codable, Identifiable, Hashable {
    enum Kind: String, Codable { case project, task, personal }

    let kind: Kind
    let id: String
    let tenantId: String
    var projectId: String?
    var title: String
    var subtitle: String?
}

/// Recent searches and opened items, persisted per account in `UserDefaults` (cleared on sign-out).
@Observable
final class SearchRecents {
    static let shared = SearchRecents()

    private(set) var queries: [String] = []
    private(set) var items: [SearchRecentItem] = []
    private var uid: String?
    private static let limit = 8

    private static func queriesKey(_ uid: String) -> String { "pf.search.recentQueries.\(uid)" }
    private static func itemsKey(_ uid: String) -> String { "pf.search.recentItems.\(uid)" }

    func prepare(uid: String?) {
        guard uid != self.uid else { return }
        self.uid = uid
        guard let uid else {
            queries = []
            items = []
            return
        }
        let defaults = UserDefaults.standard
        queries = defaults.stringArray(forKey: Self.queriesKey(uid)) ?? []
        items = defaults.data(forKey: Self.itemsKey(uid)).flatMap { try? JSONDecoder().decode([SearchRecentItem].self, from: $0) } ?? []
    }

    func addQuery(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return }
        queries.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        queries.insert(trimmed, at: 0)
        queries = Array(queries.prefix(Self.limit))
        persist()
    }

    func removeQuery(_ query: String) {
        queries.removeAll { $0 == query }
        persist()
    }

    func addItem(_ item: SearchRecentItem) {
        items.removeAll { $0.id == item.id && $0.kind == item.kind }
        items.insert(item, at: 0)
        items = Array(items.prefix(Self.limit))
        persist()
    }

    func clear() {
        queries = []
        items = []
        persist()
    }

    /// Removes the stored history of an account (sign-out, account deletion).
    static func erase(uid: String) {
        UserDefaults.standard.removeObject(forKey: queriesKey(uid))
        UserDefaults.standard.removeObject(forKey: itemsKey(uid))
        if shared.uid == uid {
            shared.queries = []
            shared.items = []
        }
    }

    private func persist() {
        guard let uid else { return }
        UserDefaults.standard.set(queries, forKey: Self.queriesKey(uid))
        UserDefaults.standard.set(try? JSONEncoder().encode(items), forKey: Self.itemsKey(uid))
    }
}
