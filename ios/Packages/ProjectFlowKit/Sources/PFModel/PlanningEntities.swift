import Foundation

/// A project label (`projects/{p}/categories/{id}`); tasks reference labels by name in `category[]`.
public struct ProjectLabel: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var name: String
    public var color: String?

    public init(id: String, name: String, color: String? = nil) {
        self.id = id
        self.name = name
        self.color = color
    }

    public init(id: String, fields f: Fields) {
        self.id = id
        name = f.string("name") ?? "—"
        color = f.string("color")
    }
}

/// A workspace group (`tenants/{t}/groups/{id}`) tasks can be assigned to (`assignedGroupIds`).
public struct WorkspaceGroup: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var name: String
    public var memberIds: [String]
    public var color: String?

    public init(id: String, name: String, memberIds: [String] = [], color: String? = nil) {
        self.id = id
        self.name = name
        self.memberIds = memberIds
        self.color = color
    }

    public init(id: String, fields f: Fields) {
        self.id = id
        name = f.string("name") ?? "—"
        memberIds = f.strings("memberIds")
        color = f.string("color")
    }
}
