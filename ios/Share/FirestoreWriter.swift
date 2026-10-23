import Foundation

/// Thin Firestore REST client for the share extension (no Firebase SDK, memory limits). The app stores the Firebase
/// refresh token in the shared keychain group; the extension exchanges it for an ID token and creates the task.
/// Same documents as `WorkActions.createPersonalTask` / `createTask` in the app (contract C1).
nonisolated struct FirestoreWriter: Sendable {
    enum Target: Sendable {
        case personal
        case project(tenantId: String, projectId: String)
    }

    enum WriterError: Error {
        /// The refresh token is gone or revoked: the user has to open the app again.
        case unauthorized
        case server(Int)
        case network
    }

    let credentials: SharedSessionCredentials

    // MARK: Public

    func createTask(title: String, descriptionHTML: String?, target: Target) async throws {
        let token = try await idToken()
        let documentId = Self.autoId()
        let documentPath: String
        var fields: [String: Any] = [
            "title": ["stringValue": title],
            "isCompleted": ["booleanValue": false],
            "status": ["stringValue": "Open"],
            "priority": ["stringValue": "Medium"],
        ]
        var transforms = ["createdAt"]
        switch target {
        case .personal:
            documentPath = "tenants/\(credentials.tenantId)/users/\(credentials.uid)/personalTasks/\(documentId)"
            fields["ownerId"] = ["stringValue": credentials.uid]
            fields["tenantId"] = ["stringValue": credentials.tenantId]
        case let .project(tenantId, projectId):
            documentPath = "tenants/\(tenantId)/projects/\(projectId)/tasks/\(documentId)"
            fields["projectId"] = ["stringValue": projectId]
            fields["tenantId"] = ["stringValue": tenantId]
            fields["ownerId"] = ["stringValue": credentials.uid]
            fields["createdBy"] = ["stringValue": credentials.uid]
            fields["updatedBy"] = ["stringValue": credentials.uid]
            fields["assigneeId"] = ["stringValue": credentials.uid]
            fields["assigneeIds"] = ["arrayValue": ["values": [["stringValue": credentials.uid]]]]
            transforms.append("updatedAt")
        }
        if let descriptionHTML, !descriptionHTML.isEmpty { fields["description"] = ["stringValue": descriptionHTML] }

        let name = "projects/\(credentials.projectId)/databases/(default)/documents/\(documentPath)"
        let body: [String: Any] = [
            "writes": [[
                "update": ["name": name, "fields": fields],
                "updateTransforms": transforms.map { ["fieldPath": $0, "setToServerValue": "REQUEST_TIME"] },
                "currentDocument": ["exists": false],
            ]],
        ]
        var request = URLRequest(url: firestoreBase.appendingPathComponent("v1/projects/\(credentials.projectId)/databases/(default)/documents:commit"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await send(request)
    }

    // MARK: Token exchange

    private func idToken() async throws -> String {
        var components = URLComponents(string: tokenEndpoint)
        components?.queryItems = [URLQueryItem(name: "key", value: credentials.apiKey)]
        guard let url = components?.url else { throw WriterError.network }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token"), URLQueryItem(name: "refresh_token", value: credentials.refreshToken)]
        request.httpBody = form.percentEncodedQuery?.data(using: .utf8)

        let data: Data
        do {
            data = try await send(request)
        } catch WriterError.server(let status) where status == 400 || status == 401 || status == 403 {
            throw WriterError.unauthorized
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let idToken = json["id_token"] as? String, json["user_id"] as? String == credentials.uid else {
            throw WriterError.unauthorized
        }
        // Firebase may rotate the refresh token; keep the keychain current.
        if let rotated = json["refresh_token"] as? String, rotated != credentials.refreshToken {
            var updated = credentials
            updated.refreshToken = rotated
            SharedSessionStore.save(updated)
        }
        return idToken
    }

    // MARK: Plumbing

    /// Auth emulator serves the token endpoint under the production host name as a path.
    private var tokenEndpoint: String {
        if let host = credentials.emulatorHost, let port = credentials.authPort {
            return "http://\(host):\(port)/securetoken.googleapis.com/v1/token"
        }
        return "https://securetoken.googleapis.com/v1/token"
    }

    private var firestoreBase: URL {
        if let host = credentials.emulatorHost, let port = credentials.firestorePort, let url = URL(string: "http://\(host):\(port)") { return url }
        return URL(string: "https://firestore.googleapis.com")!
    }

    private func send(_ request: URLRequest) async throws -> Data {
        var request = request
        request.timeoutInterval = 15
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else { throw WriterError.server(status) }
            return data
        } catch let error as WriterError {
            throw error
        } catch {
            throw WriterError.network
        }
    }

    /// 20-character id like Firestore's auto ids.
    private static func autoId() -> String {
        let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
        return String((0..<20).map { _ in alphabet[Int.random(in: 0..<alphabet.count)] })
    }
}
