import Foundation
import FirebaseFirestore
import PFData

/// `platform_config/announcement` (public read, written by the admin console). Exposes the announcement only while it
/// is active, inside its time window and not dismissed locally (per version `id`, `pf.announcement.dismissed`).
@Observable
@MainActor
final class AnnouncementStore {
    struct Announcement: Equatable {
        enum Kind: String { case info, maintenance, warning }
        let id: String
        let kind: Kind
        let text: [String: String]
        let linkURL: URL?
        let linkLabel: [String: String]
        let startsAt: Date?
        let endsAt: Date?
        let dismissible: Bool

        func localized(_ map: [String: String], language: String) -> String {
            map[language].flatMap { $0.isEmpty ? nil : $0 } ?? map["en"] ?? map.values.first ?? ""
        }
    }

    private static let dismissedKey = "pf.announcement.dismissed"

    private(set) var current: Announcement?
    private(set) var now = Date()
    private var dismissedId = UserDefaults.standard.string(forKey: AnnouncementStore.dismissedKey)
    private var registration: ListenerRegistration?
    private var ticker: Task<Void, Never>?

    /// The banner to show right now, if any.
    var visible: Announcement? {
        guard let current, current.id != dismissedId else { return nil }
        if let start = current.startsAt, start > now { return nil }
        if let end = current.endsAt, end <= now { return nil }
        return current
    }

    func start() {
        guard registration == nil else { return }
        registration = PFFirebase.db.collection("platform_config").document("announcement").addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated { self?.current = snapshot?.data().flatMap(Self.parse) }
        }
        // The time window is re-checked every minute, so a banner appears and ends on time without a new snapshot.
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                self?.now = Date()
            }
        }
    }

    func dismiss() {
        guard let current, current.dismissible else { return }
        dismissedId = current.id
        UserDefaults.standard.set(current.id, forKey: Self.dismissedKey)
    }

    private nonisolated static func parse(_ data: [String: Any]) -> Announcement? {
        guard data["active"] as? Bool == true, let id = data["id"] as? String, !id.isEmpty else { return nil }
        let text = data["text"] as? [String: String] ?? [:]
        guard text.values.contains(where: { !$0.isEmpty }) else { return nil }
        let link = data["link"] as? [String: Any]
        let url = (link?["url"] as? String).flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
        return Announcement(
            id: id,
            kind: Announcement.Kind(rawValue: data["type"] as? String ?? "") ?? .info,
            text: text,
            linkURL: url,
            linkLabel: link?["label"] as? [String: String] ?? [:],
            startsAt: (data["startsAt"] as? Timestamp)?.dateValue(),
            endsAt: (data["endsAt"] as? Timestamp)?.dateValue(),
            dismissible: data["dismissible"] as? Bool ?? true
        )
    }
}
