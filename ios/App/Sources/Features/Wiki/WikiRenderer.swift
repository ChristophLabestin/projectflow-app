import SwiftUI
import PFData
import PFDesign
import PFModel

/// Native rendering of a wiki page (Tiptap JSON). Checklist items toggle in place (`onToggle(path)`), mentions open
/// their object, files open Quick Look; unsupported nodes render their text.
struct WikiRenderer: View {
    let doc: [String: Any]
    let tenantId: String
    var onToggle: (([Int]) -> Void)?
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array((doc["content"] as? [[String: Any]] ?? []).enumerated()), id: \.offset) { index, node in
                block(node, path: [index])
            }
        }
        .environment(\.openURL, OpenURLAction { url in open(url) })
    }

    private func children(_ node: [String: Any]) -> [[String: Any]] { node["content"] as? [[String: Any]] ?? [] }
    private func attrs(_ node: [String: Any]) -> [String: Any] { node["attrs"] as? [String: Any] ?? [:] }

    private func block(_ node: [String: Any], path: [Int]) -> AnyView {
        let type = node["type"] as? String ?? ""
        switch type {
        case "paragraph":
            return AnyView(inline(children(node)).pfText(.body).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true))
        case "heading":
            let level = (attrs(node)["level"] as? NSNumber)?.intValue ?? 1
            return AnyView(inline(children(node)).pfText(level == 1 ? .title : .section).foregroundStyle(PFColor.textMain)
                .padding(.top, level == 1 ? 8 : 4).accessibilityAddTraits(.isHeader))
        case "bulletList", "orderedList", "taskList":
            return AnyView(VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(children(node).enumerated()), id: \.offset) { index, item in
                    listItem(item, marker: type == "orderedList" ? "\(index + 1)." : "•", isTask: type == "taskList", path: path + [index])
                }
            })
        case "blockquote":
            return AnyView(HStack(spacing: 10) {
                Rectangle().fill(PFColor.hairlineStrong).frame(width: 3)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(children(node).enumerated()), id: \.offset) { index, child in block(child, path: path + [index]) }
                }
            }.fixedSize(horizontal: false, vertical: true))
        case "horizontalRule":
            return AnyView(Rectangle().fill(PFColor.hairline).frame(height: 1).padding(.vertical, 4))
        case "codeBlock":
            return AnyView(Text(WikiContent.plainText(node)).font(.system(.footnote, design: .monospaced)).foregroundStyle(PFColor.textMain)
                .padding(PFSpace.s).frame(maxWidth: .infinity, alignment: .leading)
                .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous)))
        case "wikiCallout":
            let tone = attrs(node)["tone"] as? String ?? "info"
            let color: Color = tone == "warning" ? PFColor.warning : tone == "danger" ? PFColor.danger : tone == "success" ? PFColor.success : PFColor.statusBase(.open)
            return AnyView(VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(children(node).enumerated()), id: \.offset) { index, child in block(child, path: path + [index]) }
            }
            .padding(PFSpace.s).frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.12), in: .rect(cornerRadius: PFRadius.control, style: .continuous)))
        case "details":
            return AnyView(VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(children(node).enumerated()), id: \.offset) { index, child in block(child, path: path + [index]) }
            }.padding(.leading, PFSpace.s))
        case "detailsSummary":
            return AnyView(HStack(spacing: 6) { Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold)); inline(children(node)) }
                .pfText(.bodyEmphasis).foregroundStyle(PFColor.textMain))
        case "detailsContent":
            return AnyView(VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(children(node).enumerated()), id: \.offset) { index, child in block(child, path: path + [index]) }
            })
        case "wikiFile":
            let a = attrs(node)
            let name = a["name"] as? String ?? ""
            return AnyView(Button {
                if let id = a["fileId"] as? String { openFile(id: id, name: name, mime: a["mimeType"] as? String ?? "") }
            } label: {
                Label(name.isEmpty ? L10n.t("wiki.block.file") : name, systemImage: "doc").pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                    .padding(PFSpace.s).frame(maxWidth: .infinity, alignment: .leading)
                    .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
            }.buttonStyle(.pfPressable))
        case "image":
            if let src = attrs(node)["src"] as? String, let url = URL(string: src) {
                return AnyView(AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { PFSkeleton(height: 160) }
                    .clipShape(.rect(cornerRadius: PFRadius.control, style: .continuous)))
            }
            return AnyView(EmptyView())
        case "table":
            return AnyView(VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(children(node).enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .top, spacing: 0) {
                        ForEach(Array(children(row).enumerated()), id: \.offset) { _, cell in
                            Text(WikiContent.plainText(cell)).pfText(cell["type"] as? String == "tableHeader" ? .metaStrong : .meta)
                                .foregroundStyle(PFColor.textMain).padding(6).frame(maxWidth: .infinity, alignment: .leading)
                                .overlay(Rectangle().stroke(PFColor.hairline, lineWidth: 0.5))
                        }
                    }
                }
            })
        default:
            let text = WikiContent.plainText(node)
            return AnyView(Group { if !text.isEmpty { Text(text).pfText(.body).foregroundStyle(PFColor.textMuted) } })
        }
    }

    private func listItem(_ item: [String: Any], marker: String, isTask: Bool, path: [Int]) -> some View {
        let checked = attrs(item)["checked"] as? Bool == true
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            if isTask {
                Button { PFHaptics.selection(); onToggle?(path) } label: {
                    Image(systemName: checked ? "checkmark.square.fill" : "square").font(.system(size: 17, weight: .medium))
                        .foregroundStyle(checked ? PFColor.textMain : PFColor.textMuted)
                }
                .buttonStyle(.plain)
                .disabled(onToggle == nil)
                .accessibilityLabel(WikiContent.plainText(item))
                .accessibilityAddTraits(checked ? [.isButton, .isSelected] : .isButton)
            } else {
                Text(marker).pfText(.body).foregroundStyle(PFColor.textMuted)
            }
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(children(item).enumerated()), id: \.offset) { index, child in block(child, path: path + [index]) }
            }
            .opacity(isTask && checked ? 0.55 : 1)
            .strikethrough(isTask && checked, color: PFColor.textMuted)
        }
    }

    /// Text runs with marks; mentions become tappable `pf-mention://kind/id?project=…` links.
    private func inline(_ nodes: [[String: Any]]) -> Text {
        var result = AttributedString()
        for node in nodes {
            switch node["type"] as? String {
            case "text":
                var run = AttributedString(node["text"] as? String ?? "")
                for mark in node["marks"] as? [[String: Any]] ?? [] {
                    switch mark["type"] as? String {
                    case "bold": run.inlinePresentationIntent = (run.inlinePresentationIntent ?? []).union(.stronglyEmphasized)
                    case "italic": run.inlinePresentationIntent = (run.inlinePresentationIntent ?? []).union(.emphasized)
                    case "code": run.inlinePresentationIntent = (run.inlinePresentationIntent ?? []).union(.code)
                    case "strike": run.strikethroughStyle = .single
                    case "link":
                        if let href = (mark["attrs"] as? [String: Any])?["href"] as? String, let url = URL(string: href) {
                            run.link = url
                            run.underlineStyle = .single
                        }
                    default: break
                    }
                }
                result += run
            case WikiContent.mentionNode:
                let a = node["attrs"] as? [String: Any] ?? [:]
                var run = AttributedString("@" + (a["label"] as? String ?? ""))
                run.font = .body.weight(.semibold)
                var components = URLComponents()
                components.scheme = "pf-mention"
                components.host = a["kind"] as? String ?? "user"
                components.path = "/" + (a["id"] as? String ?? "")
                if let project = a["projectId"] as? String { components.queryItems = [URLQueryItem(name: "project", value: project)] }
                run.link = components.url
                result += run
            case "hardBreak":
                result += AttributedString("\n")
            default: break
            }
        }
        return Text(result)
    }

    private func open(_ url: URL) -> OpenURLAction.Result {
        guard url.scheme == "pf-mention" else { return .systemAction }
        let id = url.pathComponents.last ?? ""
        let project = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "project" })?.value
        switch url.host() {
        case "task": if let project { model.router.push(.task(TaskRef(tenantId: tenantId, projectId: project, taskId: id))) }
        case "project": model.router.push(.project(tenantId: tenantId, projectId: id))
        case "doc": model.router.push(.wikiPage(tenantId: tenantId, docId: id))
        default: break
        }
        return .handled
    }

    private func openFile(id: String, name: String, mime: String) {
        Task {
            guard let snap = try? await PFFirebase.db.collection("tenants").document(tenantId).collection("files").document(id).getDocument(),
                  let data = snap.data(), let item = FileItem.make(id: id, data: data) else { return }
            FilePreview.open(model: model, tenantId: tenantId, file: item)
        }
    }
}
