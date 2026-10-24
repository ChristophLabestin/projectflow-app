import SwiftUI
import PFData
import PFDesign
import PFModel
import FirebaseFirestore

/// Page tree of a space with search and "Neue Seite". Workspace wiki (full members) or a project's wiki.
struct WikiTreeView: View {
    let tenantId: String
    let space: WikiSpace
    @State private var store: WikiStore
    @State private var query = ""
    @Environment(AppModel.self) private var model

    init(tenantId: String, space: WikiSpace) {
        self.tenantId = tenantId
        self.space = space
        _store = State(initialValue: WikiStore(tenantId: tenantId, space: space))
    }

    private var results: [(doc: WikiDocMeta, depth: Int)] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return store.tree }
        return store.docs.filter { $0.title.lowercased().contains(needle) || $0.searchText.contains(needle) }
            .sorted { $0.title < $1.title }.map { ($0, 0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFTextField(L10n.t("wiki.search"), text: $query, systemImage: "magnifyingglass")
            if !store.isLoaded {
                PFSkeleton(height: 120)
            } else if store.docs.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text(L10n.t("wiki.empty.title")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Text(L10n.t("wiki.empty.message")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
            } else if results.isEmpty {
                Text(L10n.t("wiki.noResults")).pfText(.body).foregroundStyle(PFColor.textMuted)
            } else {
                PFCardList {
                    ForEach(results, id: \.doc.id) { item in
                        Button { model.router.push(.wikiPage(tenantId: tenantId, docId: item.doc.id)) } label: {
                            HStack(spacing: PFSpace.s) {
                                Text(item.doc.icon ?? "📄").font(.system(size: 16))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.doc.title.isEmpty ? L10n.t("wiki.untitled") : item.doc.title)
                                        .pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                                    if !item.doc.excerpt.isEmpty, !query.isEmpty || item.depth == 0 {
                                        Text(item.doc.excerpt).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                                    }
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textSubtle)
                            }
                            .padding(.leading, PFSpace.m + CGFloat(item.depth) * 18)
                            .padding(.trailing, PFSpace.m)
                            .frame(minHeight: 52)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.pfPressable)
                    }
                }
            }
            Button { createPage() } label: {
                Label(L10n.t("wiki.newPage"), systemImage: "plus").pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading).frame(minHeight: 40).contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
        }
        .task { store.start() }
        .onDisappear { store.stop() }
    }

    private func createPage() {
        let order = (store.docs.filter { $0.parentId == nil }.map(\.order).max() ?? 0) + 1
        Task {
            do {
                let id = try await WikiData.create(tenantId: tenantId, space: space, title: "", parentId: nil, order: order)
                model.router.push(.wikiPage(tenantId: tenantId, docId: id, startEditing: true))
            } catch {
                model.toasts.show(PFToast(L10n.t("wiki.error"), style: .error))
            }
        }
    }
}

/// Workspace wiki screen (Projects tab → Arbeitsbereich).
struct WikiScreen: View {
    let tenantId: String
    var body: some View {
        SettingsScaffold(title: L10n.t("wiki.title"), subtitle: L10n.t("wiki.space.workspace")) {
            WikiTreeView(tenantId: tenantId, space: .workspace).padding(.top, PFSpace.l)
        }
    }
}

/// One page: read (tap the text to edit, checklists toggle in place), simple editing, linked tasks.
struct WikiPageScreen: View {
    let tenantId: String
    let docId: String
    var startEditing = false
    @Environment(AppModel.self) private var model
    @State private var meta: WikiDocMeta?
    @State private var doc: [String: Any] = WikiContent.emptyDoc
    @State private var loaded = false
    @State private var editing = false
    @State private var title = ""
    @State private var editable = WikiEditableText(text: "", blocks: [:], mentions: [:])
    @State private var selection: TextSelection?
    @State private var saving = false
    @State private var conflictBy: String?
    @State private var taskTitles: [String: String] = [:]
    @SwiftUI.FocusState private var bodyFocused: Bool

    var body: some View {
        SettingsScaffold(title: "", topTrailing: editing ? AnyView(
            PFButton(L10n.t("wiki.edit.done"), kind: .primary, size: .small) { Task { await finishEditing() } }.disabled(saving)
        ) : nil) {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                if !loaded {
                    PFSkeleton(height: 200)
                } else if editing {
                    editor
                } else {
                    reader
                }
                if let conflictBy { conflictBanner(conflictBy) }
                if let meta, !meta.linkedTaskRefs.isEmpty, !editing { linkedTasks(meta) }
            }
        }
        .task { await load() }
    }

    // MARK: Read

    private var reader: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(meta?.title.isEmpty == false ? meta!.title : L10n.t("wiki.untitled")).pfText(.display).foregroundStyle(PFColor.textMain)
                .accessibilityAddTraits(.isHeader)
                .onTapGesture { beginEditing() }
            if let meta, let updated = meta.updatedAt {
                Text(meta.updatedByName.map { L10n.t("wiki.updated", ["time": Formatting.relative(updated), "name": $0]) }
                     ?? L10n.t("wiki.updatedShort", ["time": Formatting.relative(updated)]))
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            Group {
                if WikiContent.plainText(doc).isEmpty, (doc["content"] as? [[String: Any]] ?? []).count <= 1 {
                    Text(L10n.t("wiki.emptyPage")).pfText(.body).foregroundStyle(PFColor.textSubtle)
                } else {
                    WikiRenderer(doc: doc, tenantId: tenantId) { path in toggle(path) }
                }
            }
            .padding(.top, PFSpace.s)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
            // Tap to edit (no pencil); checkboxes, mentions and links handle their own taps.
            .onTapGesture { beginEditing() }
            .accessibilityAction(named: L10n.t("common.edit")) { beginEditing() }
        }
    }

    // MARK: Edit

    private var editor: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            TextField(L10n.t("wiki.edit.title"), text: $title, axis: .vertical)
                .pfText(.display).foregroundStyle(PFColor.textMain)
            TextEditor(text: $editable.text, selection: $selection)
                .font(.body)
                .foregroundStyle(PFColor.textMain)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 320)
                .focused($bodyFocused)
                .toolbar {
                    ToolbarItemGroup(placement: .keyboard) {
                        Button { presentMentions() } label: { Label(L10n.t("wiki.edit.mention"), systemImage: "at") }
                        Button { insert("\n- [ ] ") } label: { Label(L10n.t("wiki.edit.checklist"), systemImage: "checklist") }
                        Spacer()
                        Button(L10n.t("wiki.edit.done")) { Task { await finishEditing() } }
                    }
                }
            Text(L10n.t("wiki.edit.hint")).pfText(.meta).foregroundStyle(PFColor.textSubtle).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func beginEditing() {
        guard loaded, !editing else { return }
        title = meta?.title ?? ""
        editable = WikiEditableText.make(from: doc) { L10n.t($0) }
        withAnimation(PFMotion.respecting(PFMotion.fast)) { editing = true }
        Task { try? await Task.sleep(for: .milliseconds(150)); bodyFocused = true }
    }

    private func insert(_ snippet: String) {
        let text = editable.text
        if let selection, case .selection(let range) = selection.indices {
            editable.text.replaceSubrange(range, with: snippet)
            let index = editable.text.index(range.lowerBound, offsetBy: snippet.count)
            self.selection = TextSelection(insertionPoint: index)
        } else {
            editable.text = text + snippet
        }
    }

    private func presentMentions() {
        let people = (model.workspace?.people.values.map { $0 } ?? []).sorted { $0.displayName < $1.displayName }
        let model = model
        model.presenter.present(detents: [.fit, .large]) {
            OptionSheet(title: L10n.t("wiki.mention.people"), options: people.map { person in
                .init(id: person.id, label: person.displayName, isSelected: false) {
                    PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 26)
                }
            }) { id in
                guard let person = people.first(where: { $0.id == id }) else { return }
                editable.mentions[person.displayName] = ["id": person.id, "label": person.displayName, "kind": "user", "projectId": NSNull()]
                insert("@\(person.displayName) ")
            }
        }
    }

    private func finishEditing() async {
        let json = editable.document()
        await save(json: json, title: title.trimmingCharacters(in: .whitespacesAndNewlines))
        if conflictBy == nil {
            bodyFocused = false
            withAnimation(PFMotion.respecting(PFMotion.fast)) { editing = false }
        }
    }

    // MARK: Data

    private func load() async {
        meta = await WikiData.meta(tenantId: tenantId, docId: docId)
        doc = (try? await WikiData.body(tenantId: tenantId, docId: docId)) ?? WikiContent.emptyDoc
        loaded = true
        if startEditing { beginEditing() }
        for ref in meta?.linkedTaskRefs ?? [] {
            let parts = ref.split(separator: "/").map(String.init)
            guard parts.count == 2 else { continue }
            let snap = try? await PFFirebase.db.collection("tenants").document(tenantId).collection("projects").document(parts[0])
                .collection("tasks").document(parts[1]).getDocument()
            taskTitles[ref] = snap?.data()?["title"] as? String ?? ref
        }
    }

    private func save(json: [String: Any], title: String, force: Bool = false) async {
        guard let meta else { return }
        saving = true
        defer { saving = false }
        do {
            _ = try await WikiData.save(tenantId: tenantId, docId: docId, title: title, json: json, expectedRev: meta.bodyRev, force: force)
            doc = json
            conflictBy = nil
            self.meta = await WikiData.meta(tenantId: tenantId, docId: docId)
            PFHaptics.success()
        } catch {
            let latest = await WikiData.meta(tenantId: tenantId, docId: docId)
            if let latest, latest.bodyRev != meta.bodyRev {
                conflictBy = latest.updatedByName ?? L10n.t("wiki.conflict.someone")
            } else {
                model.toasts.show(PFToast(L10n.t("wiki.error"), style: .error))
            }
        }
    }

    private func toggle(_ path: [Int]) {
        var json = doc
        guard WikiPageScreen.flip(&json, path: path) else { return }
        doc = json
        Task { await save(json: json, title: meta?.title ?? "") }
    }

    /// Flips `attrs.checked` of the task item at `path` (child indices from the doc root).
    static func flip(_ node: inout [String: Any], path: [Int]) -> Bool {
        guard let first = path.first else {
            guard node["type"] as? String == "taskItem" else { return false }
            var attrs = node["attrs"] as? [String: Any] ?? [:]
            attrs["checked"] = !(attrs["checked"] as? Bool ?? false)
            node["attrs"] = attrs
            return true
        }
        guard var content = node["content"] as? [[String: Any]], content.indices.contains(first) else { return false }
        var child = content[first]
        let done = flip(&child, path: Array(path.dropFirst()))
        content[first] = child
        node["content"] = content
        return done
    }

    // MARK: Pieces

    private func conflictBanner(_ name: String) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(L10n.t("wiki.conflict", ["name": name])).pfText(.body).foregroundStyle(PFColor.textMain)
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("wiki.conflict.reload"), kind: .secondary, size: .small) {
                    conflictBy = nil
                    editing = false
                    Task { await load() }
                }
                PFButton(L10n.t("wiki.conflict.keep"), kind: .primary, size: .small) {
                    Task {
                        await save(json: editing ? editable.document() : doc, title: editing ? title : (meta?.title ?? ""), force: true)
                        if conflictBy == nil { editing = false }
                    }
                }
            }
        }
        .padding(PFSpace.m)
        .background(PFColor.warning.opacity(0.14), in: .rect(cornerRadius: PFRadius.card, style: .continuous))
    }

    private func linkedTasks(_ meta: WikiDocMeta) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(L10n.t("wiki.linked.tasks"))
            PFCardList {
                ForEach(meta.linkedTaskRefs, id: \.self) { ref in
                    let parts = ref.split(separator: "/").map(String.init)
                    Button {
                        if parts.count == 2 { model.router.push(.task(TaskRef(tenantId: tenantId, projectId: parts[0], taskId: parts[1]))) }
                    } label: {
                        HStack {
                            Image(systemName: "checklist").foregroundStyle(PFColor.textMuted)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(taskTitles[ref] ?? "…").pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                                Text(model.workspace?.project(parts.first)?.title ?? "").pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textSubtle)
                        }
                        .padding(.horizontal, PFSpace.m).frame(minHeight: 48).contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
        }
    }
}

/// "Docs" card in the task detail: linked pages, link an existing page, or start a new one for this task.
struct TaskLinkedDocsCard: View {
    let ref: TaskRef
    let canEdit: Bool
    @State private var docs: [WikiDocMeta] = []
    @State private var listener: ListenerRegistration?
    @Environment(AppModel.self) private var model

    private var taskRef: String { "\(ref.projectId)/\(ref.taskId)" }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(L10n.t("wiki.linked.title")).pfText(.section).foregroundStyle(PFColor.textMain)
            if docs.isEmpty {
                Text(L10n.t("wiki.linked.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            ForEach(docs) { doc in
                Button { model.router.push(.wikiPage(tenantId: ref.tenantId, docId: doc.id)) } label: {
                    HStack(spacing: PFSpace.s) {
                        Text(doc.icon ?? "📄")
                        Text(doc.title.isEmpty ? L10n.t("wiki.untitled") : doc.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 40).contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
            }
            if canEdit {
                Button { presentLinking() } label: {
                    Label(L10n.t("wiki.linked.add"), systemImage: "link").pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading).frame(minHeight: 40).contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .task {
            listener?.remove()
            listener = WikiData.listenDocs(forTask: taskRef, tenantId: ref.tenantId, projectId: ref.projectId,
                                           guest: model.session?.role == .guest) { docs = $0 }
        }
        .onDisappear { listener?.remove(); listener = nil }
    }

    private func presentLinking() {
        let model = model
        let ref = ref
        let taskRef = taskRef
        Task {
            let workspace = WikiStore(tenantId: ref.tenantId, space: .workspace)
            let project = WikiStore(tenantId: ref.tenantId, space: .project(ref.projectId))
            workspace.start(); project.start()
            try? await Task.sleep(for: .milliseconds(600))
            let candidates = (project.docs + workspace.docs).filter { !$0.taskRefs.contains(taskRef) }
            workspace.stop(); project.stop()
            var options: [OptionSheet.Option] = [.init(id: "__new", label: L10n.t("wiki.linked.new"), isSelected: false) { Image(systemName: "plus") }]
            options += candidates.map { doc in
                .init(id: doc.id, label: doc.title.isEmpty ? L10n.t("wiki.untitled") : doc.title, isSelected: false) { Text(doc.icon ?? "📄") }
            }
            model.presenter.present(detents: [.fit, .large]) {
                OptionSheet(title: L10n.t("wiki.linked.add"), options: options) { id in
                    Task {
                        do {
                            if id == "__new" {
                                let newId = try await WikiData.create(tenantId: ref.tenantId, space: .project(ref.projectId), title: "",
                                                                      parentId: nil, order: Date().timeIntervalSince1970, linkedTaskRefs: [taskRef])
                                model.router.push(.wikiPage(tenantId: ref.tenantId, docId: newId, startEditing: true))
                            } else {
                                try await WikiData.link(tenantId: ref.tenantId, docId: id, taskRef: taskRef)
                            }
                        } catch {
                            model.toasts.show(PFToast(L10n.t("wiki.error"), style: .error))
                        }
                    }
                }
            }
        }
    }
}
