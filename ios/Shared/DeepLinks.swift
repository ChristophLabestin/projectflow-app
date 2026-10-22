import Foundation

/// `projectflow://` routes understood by `AppRouter.handle` (contract C8). Widgets, Live Activities,
/// controls, Spotlight and the share extension build their links here.
nonisolated enum PFLink {
    private static func url(_ host: String, _ path: [String] = [], tenant: String? = nil, query: [String: String] = [:]) -> URL {
        var components = URLComponents()
        components.scheme = SharedConstants.urlScheme
        components.host = host
        components.path = path.isEmpty ? "" : "/" + path.map { $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? $0 }.joined(separator: "/")
        var items = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        if let tenant, !tenant.isEmpty { items.insert(URLQueryItem(name: "tenant", value: tenant), at: 0) }
        components.queryItems = items.isEmpty ? nil : items
        return components.url ?? URL(string: "\(SharedConstants.urlScheme)://today")!
    }

    static var today: URL { url("today") }
    static var focus: URL { url("focus") }
    static var capture: URL { url("capture") }
    static var inbox: URL { url("notifications") }

    static func project(tenantId: String, projectId: String) -> URL {
        url("project", [projectId], tenant: tenantId)
    }

    static func task(tenantId: String, projectId: String, taskId: String) -> URL {
        url("project", [projectId, "tasks", taskId], tenant: tenantId)
    }

    static func personalTask(tenantId: String, id: String) -> URL {
        url("personal-tasks", [id], tenant: tenantId)
    }

    /// Link for a Today stop (project task or personal task).
    static func stop(id: String, tenantId: String, projectId: String?, isPersonal: Bool) -> URL {
        guard !isPersonal, let projectId else { return personalTask(tenantId: tenantId, id: id) }
        return task(tenantId: tenantId, projectId: projectId, taskId: id)
    }

    /// Link for the focused item.
    static func focusItem(itemId: String, itemType: String, tenantId: String?, projectId: String?) -> URL {
        guard let tenantId else { return focus }
        if itemType == "task", let projectId { return task(tenantId: tenantId, projectId: projectId, taskId: itemId) }
        if itemType == "personal-task" { return personalTask(tenantId: tenantId, id: itemId) }
        return focus
    }
}
