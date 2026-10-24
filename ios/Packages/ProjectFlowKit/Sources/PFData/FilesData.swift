import Foundation
import FirebaseFirestore

// Files & attachments (`brain/plans/files-concept.md`): `tenants/{t}/files`, written only through callables
// (`createTenantFileUploadSession`/`finalizeTenantFileUpload`, `getTenantFileUrls`, `trashTenantFile`, …).

public struct FileParent: Sendable, Hashable {
    public enum Kind: String, Sendable { case task, initiative, project, comment, doc, workspace }
    public let kind: Kind
    public let id: String
    public let projectId: String?
    public let rootKind: Kind
    public let rootId: String
    public let title: String?

    public init(kind: Kind, id: String, projectId: String?, rootKind: Kind? = nil, rootId: String? = nil, title: String? = nil) {
        self.kind = kind; self.id = id; self.projectId = projectId
        self.rootKind = rootKind ?? kind; self.rootId = rootId ?? id; self.title = title
    }

    var json: [String: Any] {
        var value: [String: Any] = ["type": kind.rawValue, "id": id, "rootType": rootKind.rawValue, "rootId": rootId]
        value["projectId"] = projectId ?? NSNull()
        if let title { value["title"] = title }
        return value
    }
}

public struct FileItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let mimeType: String
    public let sizeBytes: Int
    public let isTrashed: Bool
    public let projectId: String?
    public let parentKind: String?
    public let parentId: String?
    public let rootKind: String?
    public let rootId: String?
    public let parentTitle: String?
    public let uploaderName: String
    public let createdBy: String?
    public let createdAt: Date
    public let version: Int

    init?(id: String, data: [String: Any]) {
        self.id = id
        name = (data["name"] as? String) ?? (data["fileName"] as? String) ?? id
        mimeType = data["mimeType"] as? String ?? "application/octet-stream"
        sizeBytes = (data["sizeBytes"] as? NSNumber)?.intValue ?? 0
        isTrashed = (data["status"] as? String) == "trashed"
        projectId = data["projectId"] as? String
        let parent = data["parent"] as? [String: Any]
        parentKind = parent?["type"] as? String ?? data["entityType"] as? String
        parentId = parent?["id"] as? String ?? data["entityId"] as? String
        rootKind = parent?["rootType"] as? String
        rootId = parent?["rootId"] as? String ?? data["entityId"] as? String
        parentTitle = parent?["title"] as? String
        uploaderName = data["uploaderName"] as? String ?? ""
        createdBy = data["createdBy"] as? String
        createdAt = (data["createdAt"] as? Timestamp)?.dateValue() ?? .distantPast
        version = (data["version"] as? NSNumber)?.intValue ?? 1
    }

    public static func make(id: String, data: [String: Any]) -> FileItem? { FileItem(id: id, data: data) }

    public var isImage: Bool { mimeType.hasPrefix("image/") }
    public var kindSymbol: String {
        if mimeType.hasPrefix("image/") { return "photo" }
        if mimeType == "application/pdf" { return "doc.richtext" }
        if mimeType.hasPrefix("video/") { return "film" }
        if mimeType.hasPrefix("audio/") { return "waveform" }
        if mimeType.contains("sheet") || mimeType.contains("excel") || mimeType.contains("csv") { return "tablecells" }
        if mimeType.contains("presentation") || mimeType.contains("powerpoint") { return "rectangle.on.rectangle" }
        if mimeType.contains("zip") || mimeType.contains("compressed") { return "doc.zipper" }
        return "doc"
    }
}

/// Live merged listeners (several queries, one list) for the files of an object or of the workspace.
@Observable
public final class FilesStore {
    public private(set) var files: [FileItem] = []
    public private(set) var isLoaded = false
    private var registrations: [ListenerRegistration] = []
    private var buckets: [Int: [FileItem]] = [:]
    private let queries: [Query]

    /// Attachments of one object (task, project, doc): the new `parent.rootId` plus legacy desktop attachments.
    public static func parent(tenantId: String, projectId: String?, rootId: String) -> FilesStore {
        let ref = PFFirebase.db.collection("tenants").document(tenantId).collection("files")
        var queries: [Query] = []
        if let projectId {
            queries.append(ref.whereField("projectId", isEqualTo: projectId).whereField("parent.rootId", isEqualTo: rootId))
            queries.append(ref.whereField("projectId", isEqualTo: projectId).whereField("entityId", isEqualTo: rootId)
                .whereField("entityType", in: ["task-attachment", "initiative-attachment"]))
        } else {
            queries.append(ref.whereField("projectId", isEqualTo: NSNull()).whereField("parent.rootId", isEqualTo: rootId))
        }
        return FilesStore(queries: queries)
    }

    /// Every file the user may see (guests: only their projects, rules must be able to prove the query).
    public static func workspace(tenantId: String, isGuest: Bool, projectIds: [String]) -> FilesStore {
        let ref = PFFirebase.db.collection("tenants").document(tenantId).collection("files")
        let queries: [Query] = isGuest
            ? projectIds.prefix(30).map { ref.whereField("projectId", isEqualTo: $0).whereField("listed", isEqualTo: true) }
            : [ref.whereField("listed", isEqualTo: true), ref.whereField("module", isEqualTo: "media"),
               ref.whereField("entityType", in: ["task-attachment", "initiative-attachment"])]
        return FilesStore(queries: queries)
    }

    init(queries: [Query]) { self.queries = queries }

    public func start() {
        guard registrations.isEmpty else { return }
        for (index, query) in queries.enumerated() {
            registrations.append(query.addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    self.buckets[index] = snapshot?.documents.compactMap { FileItem(id: $0.documentID, data: $0.data()) } ?? []
                    var seen = Set<String>()
                    self.files = self.buckets.values.flatMap { $0 }.filter { seen.insert($0.id).inserted }
                        .sorted { $0.createdAt > $1.createdAt }
                    self.isLoaded = true
                }
            })
        }
    }

    public func stop() { registrations.forEach { $0.remove() }; registrations = [] }
}

public enum FilesData {
    /// Short-lived signed URLs (15 min) after a rights check, per file.
    public static func urls(tenantId: String, fileIds: [String], download: Bool = false) async throws -> [String: URL] {
        let data = try await PFCallables.call("getTenantFileUrls", ["tenantId": tenantId, "fileIds": fileIds, "download": download, "version": 0])
        let urls = (data as? [String: Any])?["urls"] as? [String: String] ?? [:]
        return urls.compactMapValues(URL.init(string:))
    }

    /// Downloads one file into a temp folder (named like the file, so Quick Look picks the right viewer).
    public static func localCopy(tenantId: String, file: FileItem) async throws -> URL {
        guard let remote = try await urls(tenantId: tenantId, fileIds: [file.id])[file.id] else { throw FileUploadError.badResponse }
        let (temp, _) = try await URLSession.shared.download(from: remote)
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("pf-files/\(file.id)", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let target = folder.appendingPathComponent(file.name.isEmpty ? file.id : file.name)
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: temp, to: target)
        return target
    }

    @MainActor
    public static func upload(tenantId: String, parent: FileParent, fileName: String, mimeType: String, data: Data) async throws -> UploadedTenantFile {
        try await FileUploads.upload(tenantId: tenantId, module: "files", entityType: parent.kind.rawValue, entityId: parent.id,
                                     projectId: parent.projectId, fileName: fileName, mimeType: mimeType, data: data, parent: parent.json)
    }

    public static func trash(tenantId: String, fileId: String) async throws {
        _ = try await PFCallables.call("trashTenantFile", ["tenantId": tenantId, "fileId": fileId])
    }

    public static func restore(tenantId: String, fileId: String) async throws {
        _ = try await PFCallables.call("restoreTenantFile", ["tenantId": tenantId, "fileId": fileId])
    }

    public static func purge(tenantId: String, fileId: String) async throws {
        _ = try await PFCallables.call("purgeTenantFile", ["tenantId": tenantId, "fileId": fileId])
    }

    public struct Quota: Sendable { public let usedBytes: Int64; public let quotaBytes: Int64?; public let maxFileBytes: Int64 }

    public static func quota(tenantId: String) async -> Quota? {
        guard let data = try? await PFCallables.call("getWorkspaceFileQuota", ["tenantId": tenantId]) as? [String: Any] else { return nil }
        return Quota(usedBytes: (data["usedBytes"] as? NSNumber)?.int64Value ?? 0, quotaBytes: (data["quotaBytes"] as? NSNumber)?.int64Value,
                     maxFileBytes: (data["maxFileBytes"] as? NSNumber)?.int64Value ?? 50 * 1024 * 1024)
    }
}
