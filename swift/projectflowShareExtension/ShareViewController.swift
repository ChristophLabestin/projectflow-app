import Social
import UniformTypeIdentifiers

final class ShareViewController: SLComposeServiceViewController {
    override func isContentValid() -> Bool {
        true
    }

    override func didSelectPost() {
        collectSharedContent { [weak self] capture in
            if let capture {
                ProjectFlowShareCaptureQueue.enqueue(capture)
            }
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }

    override func configurationItems() -> [Any]! {
        []
    }

    private func collectSharedContent(completion: @escaping (ProjectFlowShareCapture?) -> Void) {
        let baseText = contentText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        guard !providers.isEmpty else {
            completion(capture(from: baseText, url: nil))
            return
        }

        let group = DispatchGroup()
        var resolvedText = baseText
        var resolvedURL: String?

        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                    if let url = item as? URL {
                        resolvedURL = url.absoluteString
                    } else if let urlString = item as? String {
                        resolvedURL = urlString
                    }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                    if let text = item as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        resolvedText = resolvedText.isEmpty ? text : "\(resolvedText)\n\n\(text)"
                    }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) {
            completion(self.capture(from: resolvedText, url: resolvedURL))
        }
    }

    private func capture(from text: String, url: String?) -> ProjectFlowShareCapture? {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedURL = url?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty || trimmedURL?.isEmpty == false else {
            return nil
        }

        let titleSource = trimmedText.isEmpty ? trimmedURL ?? "Shared item" : trimmedText
        let title = titleSource
            .components(separatedBy: .newlines)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .prefix(90)
        ?? "Shared item"

        return ProjectFlowShareCapture(
            title: String(title),
            text: trimmedText.isEmpty ? trimmedURL ?? "" : trimmedText,
            url: trimmedURL
        )
    }
}
