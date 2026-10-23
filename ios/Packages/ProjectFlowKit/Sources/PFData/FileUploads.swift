import Foundation

public struct UploadedTenantFile: Sendable, Hashable {
    public let id: String
    public let downloadURL: String
}

public enum FileUploadError: LocalizedError {
    case badResponse
    case httpStatus(Int)

    public var errorDescription: String? {
        switch self {
        case .badResponse: "The upload service returned an unexpected response."
        case .httpStatus(let code): "Upload failed (HTTP \(code))."
        }
    }
}

/// Tenant file pipeline, same flow as web `uploadTenantFile`: `createTenantFileUploadSession` →
/// PUT/POST to the signed target → `finalizeTenantFileUpload` (returns the file incl. `downloadUrl`).
@MainActor
public enum FileUploads {
    // swiftlint:disable:next function_parameter_count
    public static func upload(tenantId: String, module: String, entityType: String, entityId: String, projectId: String? = nil,
                              fileName: String, mimeType: String, data: Data) async throws -> UploadedTenantFile {
        var session: [String: Any] = [
            "tenantId": tenantId, "module": module, "entityType": entityType, "entityId": entityId,
            "fileName": fileName, "mimeType": mimeType, "sizeBytes": data.count,
        ]
        if let projectId { session["projectId"] = projectId }
        guard let created = try await PFCallables.call("createTenantFileUploadSession", session) as? [String: Any],
              let draftId = created["uploadDraftId"] as? String,
              let target = created["uploadTarget"] as? [String: Any],
              let urlString = target["url"] as? String, let url = URL(string: urlString) else { throw FileUploadError.badResponse }

        var request = URLRequest(url: url)
        request.httpMethod = (target["method"] as? String) ?? "PUT"
        for (key, value) in (target["headers"] as? [String: String]) ?? [:] { request.setValue(value, forHTTPHeaderField: key) }
        let (body, response) = try await URLSession.shared.upload(for: request, from: data)
        guard let http = response as? HTTPURLResponse else { throw FileUploadError.badResponse }
        guard (200..<300).contains(http.statusCode) else { throw FileUploadError.httpStatus(http.statusCode) }

        var providerResult: [String: Any] = ["status": http.statusCode, "responseBody": String(bytes: body, encoding: .utf8) ?? ""]
        if let parsed = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
            for (key, value) in parsed { providerResult[key] = value }
        }
        let finalizePayload: [String: Any] = ["tenantId": tenantId, "uploadDraftId": draftId, "providerResult": providerResult]
        guard let finalized = try await PFCallables.call("finalizeTenantFileUpload", finalizePayload) as? [String: Any],
              let file = finalized["file"] as? [String: Any],
              let id = file["id"] as? String, let downloadURL = file["downloadUrl"] as? String else { throw FileUploadError.badResponse }
        return UploadedTenantFile(id: id, downloadURL: downloadURL)
    }
}
