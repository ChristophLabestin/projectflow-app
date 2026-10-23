import Foundation
import Observation
import UniformTypeIdentifiers
import PFSnapshot

/// State of the share composer: what was shared, where it goes, and how saving went.
@MainActor
@Observable
final class ShareModel {
    enum Target: Hashable {
        case personal
        case project(TodaySnapshot.ProjectRef)
    }

    enum Phase: Equatable {
        case editing, saving, saved, queued
        case failed(String)
    }

    var title = ""
    var url: URL?
    /// Extra text shared next to the title/URL.
    var details = ""
    var target: Target = .personal
    var phase: Phase = .editing
    private(set) var projects: [TodaySnapshot.ProjectRef] = []
    private(set) var hasSession = false
    private(set) var strings: ExtensionStrings

    private weak var context: NSExtensionContext?
    private static let lastTargetKey = "share.lastTarget"

    init(context: NSExtensionContext?) {
        self.context = context
        let snapshot = SnapshotStore.load()
        strings = ExtensionStrings(language: snapshot?.language)
        let credentials = SharedSessionStore.load()
        hasSession = credentials != nil
        if let credentials, let snapshot, snapshot.signedIn {
            projects = snapshot.projects.filter { $0.tenantId == credentials.tenantId }
            let last = UserDefaults(suiteName: SharedConstants.appGroup)?.string(forKey: Self.lastTargetKey)
            if let last, let project = projects.first(where: { $0.id == last }) { target = .project(project) }
        }
    }

    var canSave: Bool { !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && phase != .saving }

    // MARK: Input

    func loadInput() async {
        guard let items = context?.inputItems as? [NSExtensionItem] else { return }
        var foundURL: URL?
        var foundText: String?
        var pageTitle: String?
        for item in items {
            if pageTitle == nil, let value = item.attributedTitle?.string.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty { pageTitle = value }
            if foundText == nil, let value = item.attributedContentText?.string.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty { foundText = value }
            for provider in item.attachments ?? [] {
                if foundURL == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    foundURL = await Self.loadURL(from: provider)
                }
                if foundText == nil, provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    foundText = await Self.loadText(from: provider)
                }
            }
        }
        // Plain text that is just a link behaves like a shared link.
        if foundURL == nil, let text = foundText, let link = URL(string: text), ["http", "https"].contains(link.scheme?.lowercased() ?? "") {
            foundURL = link
            foundText = nil
        }
        compose(url: foundURL, text: foundText, pageTitle: pageTitle)
    }

    private func compose(url: URL?, text: String?, pageTitle: String?) {
        self.url = url
        let lines = (text ?? "").split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if let url {
            let candidate = pageTitle ?? lines.first { $0 != url.absoluteString } ?? url.host() ?? url.absoluteString
            title = String(candidate.prefix(200))
            let rest = lines.filter { $0 != candidate && $0 != url.absoluteString }
            details = rest.joined(separator: "\n")
        } else if let first = lines.first {
            title = String(first.prefix(200))
            details = lines.dropFirst().joined(separator: "\n")
        } else if let pageTitle {
            title = String(pageTitle.prefix(200))
        }
    }

    private nonisolated static func loadURL(from provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { value, _ in
                let url = value as? URL
                continuation.resume(returning: url.flatMap { $0.isFileURL ? nil : $0 })
            }
        }
    }

    private nonisolated static func loadText(from provider: NSItemProvider) async -> String? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { value, _ in
                if let text = value as? String {
                    continuation.resume(returning: text)
                } else if let data = value as? Data {
                    continuation.resume(returning: String(data: data, encoding: .utf8))
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    // MARK: Output

    /// Plain note for the app-side queue (no session).
    private var plainNote: String? {
        let parts = [url?.absoluteString, details.isEmpty ? nil : details].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: "\n")
    }

    /// Task descriptions are HTML on the web.
    private var descriptionHTML: String? {
        var paragraphs: [String] = []
        if let url {
            let escaped = Self.escape(url.absoluteString)
            paragraphs.append("<p><a href=\"\(escaped)\">\(escaped)</a></p>")
        }
        for line in details.split(whereSeparator: \.isNewline) {
            paragraphs.append("<p>\(Self.escape(String(line)))</p>")
        }
        return paragraphs.isEmpty ? nil : paragraphs.joined()
    }

    private static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
    }

    func save() async {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            phase = .failed(strings.t("share.empty"))
            return
        }
        guard let credentials = SharedSessionStore.load() else {
            queue(title: trimmed)
            return
        }
        phase = .saving
        let writerTarget: FirestoreWriter.Target
        switch target {
        case .personal: writerTarget = .personal
        case .project(let project): writerTarget = .project(tenantId: project.tenantId, projectId: project.id)
        }
        let html = descriptionHTML
        do {
            try await FirestoreWriter(credentials: credentials).createTask(title: trimmed, descriptionHTML: html, target: writerTarget)
            rememberTarget()
            phase = .saved
            await finish(after: .milliseconds(900))
        } catch FirestoreWriter.WriterError.unauthorized {
            queue(title: trimmed)
        } catch {
            phase = .failed(strings.t("share.error"))
        }
    }

    /// No valid session (signed out, revoked): keep the capture; the app creates the task when it opens.
    func queue(title: String? = nil) {
        let text = (title ?? self.title).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        var captures = SnapshotStore.pendingCaptures()
        captures.append(SnapshotStore.PendingCapture(title: text, note: plainNote))
        SnapshotStore.setPendingCaptures(captures)
        phase = .queued
        Task { await finish(after: .milliseconds(2400)) }
    }

    func cancel() {
        context?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
    }

    private func finish(after delay: Duration) async {
        try? await Task.sleep(for: delay)
        context?.completeRequest(returningItems: nil)
    }

    private func rememberTarget() {
        let value: String
        switch target {
        case .personal: value = "personal"
        case .project(let project): value = project.id
        }
        UserDefaults(suiteName: SharedConstants.appGroup)?.set(value, forKey: Self.lastTargetKey)
    }
}
