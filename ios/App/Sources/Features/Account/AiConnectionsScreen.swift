import SwiftUI
import PFData
import PFDesign

/// Verbundene KI-Apps: the user's AI clients (MCP OAuth) and personal access tokens across their workspaces,
/// via `listAiConnections` / `revokeAiConnection`. Connecting new clients and creating tokens stays web-only.
struct AiConnectionsScreen: View {
    struct Connection: Identifiable, Hashable {
        let id: String
        let isToken: Bool
        let clientName: String
        let workspace: String
        let scopes: [String]
        let tokenPrefix: String?
        let createdAt: Date?
        let lastUsedAt: Date?
        let expiresAt: Date?
    }

    static let manageURL = URL(string: "https://app.getprojectflow.com/?openSettings=ai")!

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @Environment(\.openURL) private var openURL
    @State private var connections: [Connection] = []
    @State private var loaded = false
    @State private var failed = false

    var body: some View {
        SettingsScaffold(title: L10n.t("aiApps.title"), subtitle: L10n.t("aiApps.subtitle")) {
            PFSectionHeader(L10n.t("aiApps.connected"))
            SettingsCard(footer: L10n.t("aiApps.footer")) {
                if !loaded {
                    PFSkeleton(height: 20).padding(PFSpace.m)
                } else if failed {
                    SettingsRow(systemImage: "exclamationmark.triangle", title: L10n.t("aiApps.error"), showsChevron: false) {
                        Task { await load() }
                    }
                } else if connections.isEmpty {
                    SettingsRow(systemImage: "sparkles", title: L10n.t("aiApps.empty"), showsChevron: false)
                }
                ForEach(connections) { connection in
                    row(connection)
                }
            }

            PFSectionHeader(L10n.t("aiApps.connect.title"))
            SettingsCard(footer: L10n.t("aiApps.connect.note")) {
                VStack(alignment: .leading, spacing: PFSpace.s) {
                    Text(L10n.t("aiApps.connect.body")).pfText(.body).foregroundStyle(PFColor.textMain)
                        .fixedSize(horizontal: false, vertical: true)
                    PFButton(L10n.t("aiApps.connect.open"), systemImage: "arrow.up.right", kind: .secondary, size: .small) {
                        openURL(Self.manageURL)
                    }
                }
                .padding(PFSpace.m)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func row(_ connection: Connection) -> some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            Image(systemName: connection.isToken ? "key" : "sparkles")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(PFColor.textMuted)
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(connection.clientName).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                Text(primaryLine(connection)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Text(dateLine(connection)).pfText(.meta).foregroundStyle(PFColor.textSubtle)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            PFButton(L10n.t("aiApps.revoke"), kind: .ghost, size: .small) { confirmRevoke(connection) }
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: L10n.t("aiApps.revoke")) { confirmRevoke(connection) }
    }

    /// "Workspace · Personal access token pfp_ab12 · Read & write"
    private func primaryLine(_ connection: Connection) -> String {
        var parts = [connection.workspace]
        if connection.isToken {
            parts.append([L10n.t("aiApps.kind.token"), connection.tokenPrefix].compactMap { $0 }.joined(separator: " "))
        }
        parts.append(Self.scopeSummary(connection.scopes))
        return parts.joined(separator: " · ")
    }

    private func dateLine(_ connection: Connection) -> String {
        var parts: [String] = []
        if let created = connection.createdAt {
            parts.append(L10n.t("aiApps.connectedAt", ["date": created.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale))]))
        }
        parts.append(connection.lastUsedAt.map { L10n.t("aiApps.lastUsed", ["date": Formatting.relative($0)]) } ?? L10n.t("aiApps.neverUsed"))
        if connection.isToken, let expires = connection.expiresAt {
            parts.append(L10n.t("aiApps.expires", ["date": expires.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale))]))
        }
        return parts.joined(separator: " · ")
    }

    /// Same buckets as the web: read only / read & write / read, write & delete.
    static func scopeSummary(_ scopes: [String]) -> String {
        if scopes.contains(where: { $0.hasSuffix(":delete") }) { return L10n.t("aiApps.scopes.delete") }
        if scopes.contains(where: { $0.hasSuffix(":write") }) { return L10n.t("aiApps.scopes.write") }
        return L10n.t("aiApps.scopes.read")
    }

    // MARK: Data

    private func load() async {
        let workspaces = model.session?.workspaces ?? []
        var result: [Connection] = []
        var anyFailed = false
        for workspace in workspaces {
            guard let response = try? await PFCallables.call("listAiConnections", ["tenantId": workspace.id]) as? [String: Any],
                  let items = response["connections"] as? [[String: Any]] else { anyFailed = true; continue }
            result += items.compactMap { Self.connection($0, workspace: workspace.name) }
        }
        connections = result.sorted { ($0.lastUsedAt ?? $0.createdAt ?? .distantPast) > ($1.lastUsedAt ?? $1.createdAt ?? .distantPast) }
        failed = anyFailed && result.isEmpty
        loaded = true
    }

    static func connection(_ data: [String: Any], workspace: String) -> Connection? {
        guard let id = data["id"] as? String else { return nil }
        let isToken = (data["kind"] as? String) == "personal-token"
        return Connection(id: id, isToken: isToken,
                          clientName: (data["clientName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
                              ?? L10n.t(isToken ? "aiApps.kind.token" : "aiApps.unknownClient"),
                          workspace: workspace,
                          scopes: data["scopes"] as? [String] ?? [],
                          tokenPrefix: data["tokenPrefix"] as? String,
                          createdAt: date(data["createdAt"]), lastUsedAt: date(data["lastUsedAt"]), expiresAt: date(data["expiresAt"]))
    }

    private static func date(_ value: Any?) -> Date? {
        guard let string = value as? String else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }

    private func confirmRevoke(_ connection: Connection) {
        presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("aiApps.revokeTitle"),
                         message: L10n.t("aiApps.revokeMessage", ["name": connection.clientName, "workspace": connection.workspace]),
                         confirmTitle: L10n.t("aiApps.revoke")) {
                Task {
                    do {
                        _ = try await PFCallables.call("revokeAiConnection", ["grantId": connection.id])
                        connections.removeAll { $0.id == connection.id }
                        PFHaptics.success()
                        model.toasts.show(PFToast(L10n.t("aiApps.revoked"), style: .success))
                    } catch {
                        model.toasts.show(PFToast(L10n.t("aiApps.error"), style: .error))
                    }
                }
            }
        }
    }
}
