import SwiftUI
import PFData
import PFDesign

/// Attachments of one object (task, project): list with preview, upload from camera / photos / Files, row actions.
struct FileAttachmentsCard: View {
    let tenantId: String
    let parent: FileParent
    var canUpload = true
    @State private var store: FilesStore
    @State private var uploading: (done: Int, total: Int)?
    @Environment(AppModel.self) private var model

    init(tenantId: String, parent: FileParent, canUpload: Bool = true) {
        self.tenantId = tenantId
        self.parent = parent
        self.canUpload = canUpload
        _store = State(initialValue: FilesStore.parent(tenantId: tenantId, projectId: parent.projectId, rootId: parent.rootId))
    }

    private var visible: [FileItem] { store.files.filter { !$0.isTrashed } }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                Text(L10n.t("files.attachments.title")).pfText(.section).foregroundStyle(PFColor.textMain)
                if !visible.isEmpty { Text("\(visible.count)").pfText(.metaStrong).foregroundStyle(PFColor.textMuted) }
                Spacer()
            }
            if !store.isLoaded {
                PFSkeleton(height: 20)
            } else if visible.isEmpty, uploading == nil {
                Text(L10n.t(canUpload ? "files.attachments.emptyMobile" : "files.empty.title")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            VStack(spacing: 0) {
                ForEach(Array(visible.enumerated()), id: \.element.id) { index, file in
                    if index > 0 { PFRowDivider() }
                    FileRow(file: file, tenantId: tenantId)
                }
            }
            if let uploading {
                HStack(spacing: PFSpace.xs) {
                    ProgressView().controlSize(.small)
                    Text(L10n.t("files.upload.progress", ["done": uploading.done, "total": uploading.total])).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
            }
            if canUpload {
                // Tap target is the whole row (no extra "+" icon in the header): same pattern as "Teilaufgabe hinzufügen".
                Button { presentSources() } label: {
                    Label(L10n.t("files.attachments.addMobile"), systemImage: "paperclip")
                        .pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading).frame(minHeight: 40).contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
                .disabled(uploading != nil)
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .task { store.start() }
        .onDisappear { store.stop() }
    }

    private func presentSources() {
        let model = model
        model.presenter.present(detents: [.fit]) {
            OptionSheet(title: L10n.t("files.attachments.addMobile"), options: [
                .init(id: "camera", label: L10n.t("files.source.camera"), isSelected: false) { Image(systemName: "camera") },
                .init(id: "photos", label: L10n.t("files.source.photos"), isSelected: false) { Image(systemName: "photo.on.rectangle") },
                .init(id: "files", label: L10n.t("files.source.files"), isSelected: false) { Image(systemName: "folder") },
            ]) { id in
                Task {
                    try? await Task.sleep(for: .milliseconds(350))
                    let source: FilePicking.Source = id == "camera" ? .camera : id == "photos" ? .photos : .files
                    await upload(await FilePicking.pick(source))
                }
            }
        }
    }

    private func upload(_ files: [PickedFile]) async {
        guard !files.isEmpty else { return }
        var failed: [String] = []
        uploading = (0, files.count)
        for (index, file) in files.enumerated() {
            do {
                _ = try await FilesData.upload(tenantId: tenantId, parent: parent, fileName: file.name, mimeType: file.mimeType, data: file.data)
            } catch {
                failed.append(file.name)
            }
            uploading = (index + 1, files.count)
        }
        uploading = nil
        if failed.isEmpty { PFHaptics.success() } else {
            model.toasts.show(PFToast(L10n.t("files.error.failed", ["names": failed.joined(separator: ", ")]), style: .error))
        }
    }
}

/// One file: type icon, name, size · uploader; tap = Quick Look; "…" = actions (preview, share, trash).
struct FileRow: View {
    let file: FileItem
    let tenantId: String
    var showsOrigin = false
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: PFSpace.s) {
            Button { FilePreview.open(model: model, tenantId: tenantId, file: file) } label: {
                HStack(spacing: PFSpace.s) {
                    Image(systemName: file.kindSymbol).font(.system(size: 15, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                        .frame(width: 34, height: 34).background(PFColor.raised, in: .rect(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(file.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                        Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            PFIconButton("ellipsis", label: L10n.t("files.action.menu", ["name": file.name]), style: .plain, size: 34) { presentActions() }
        }
        .padding(.vertical, 8)
    }

    private var subtitle: String {
        var parts = [ByteCountFormatter.string(fromByteCount: Int64(file.sizeBytes), countStyle: .file)]
        if !file.uploaderName.isEmpty { parts.append(file.uploaderName) }
        if showsOrigin, let title = file.parentTitle, !title.isEmpty { parts.append(title) }
        parts.append(file.createdAt.formatted(.dateTime.day().month(.abbreviated).locale(L10n.locale)))
        return parts.joined(separator: " · ")
    }

    private func presentActions() {
        let model = model
        let file = file
        let tenantId = tenantId
        var options: [OptionSheet.Option] = [
            .init(id: "preview", label: L10n.t("files.action.preview"), isSelected: false) { Image(systemName: "eye") },
            .init(id: "share", label: L10n.t("files.action.download"), isSelected: false) { Image(systemName: "square.and.arrow.up") },
        ]
        if file.isTrashed {
            options.append(.init(id: "restore", label: L10n.t("files.action.restore"), isSelected: false) { Image(systemName: "arrow.uturn.backward") })
        } else {
            options.append(.init(id: "trash", label: L10n.t("files.action.trash"), isSelected: false) { Image(systemName: "trash") })
        }
        model.presenter.present(detents: [.fit]) {
            OptionSheet(title: file.name, options: options) { id in
                Task {
                    try? await Task.sleep(for: .milliseconds(350))
                    switch id {
                    case "preview": FilePreview.open(model: model, tenantId: tenantId, file: file)
                    case "share": await FileRow.share(model: model, tenantId: tenantId, file: file)
                    case "trash":
                        do { try await FilesData.trash(tenantId: tenantId, fileId: file.id); model.toasts.show(PFToast(L10n.t("files.toast.trashed"))) }
                        catch { model.toasts.show(PFToast(L10n.t("files.error.action"), style: .error)) }
                    case "restore":
                        do { try await FilesData.restore(tenantId: tenantId, fileId: file.id); model.toasts.show(PFToast(L10n.t("files.toast.restored"))) }
                        catch { model.toasts.show(PFToast(L10n.t("files.error.action"), style: .error)) }
                    default: break
                    }
                }
            }
        }
    }

    /// Download = the system share sheet with the local copy (save to Files, AirDrop, open in …).
    static func share(model: AppModel, tenantId: String, file: FileItem) async {
        do {
            let url = try await FilesData.localCopy(tenantId: tenantId, file: file)
            let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            FilePicking.topViewController()?.present(controller, animated: true)
        } catch {
            model.toasts.show(PFToast(L10n.t("files.preview.error"), style: .error))
        }
    }
}

/// "Dateien" overview: every file the user may see, search, trash, storage usage.
struct FilesScreen: View {
    let tenantId: String
    @Environment(AppModel.self) private var model
    @State private var store: FilesStore?
    @State private var query = ""
    @State private var showsTrash = false
    @State private var quota: FilesData.Quota?

    private var files: [FileItem] {
        let base = (store?.files ?? []).filter { $0.isTrashed == showsTrash }
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        return needle.isEmpty ? base : base.filter { $0.name.lowercased().contains(needle) || ($0.parentTitle ?? "").lowercased().contains(needle) }
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("nav.files"), subtitle: L10n.t("files.subtitle")) {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                PFTextField(L10n.t("files.search.placeholder"), text: $query, systemImage: "magnifyingglass")
                PFSegmented([(value: false, label: L10n.t("nav.files")), (value: true, label: L10n.t("files.trash.open"))], selection: $showsTrash)
                if showsTrash {
                    Text(L10n.t("files.trash.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                }
                if store?.isLoaded != true {
                    PFSkeleton(height: 120)
                } else if files.isEmpty {
                    Text(L10n.t(showsTrash ? "files.empty.trash" : query.isEmpty ? "files.empty.title" : "files.empty.filtered"))
                        .pfText(.body).foregroundStyle(PFColor.textMuted)
                } else {
                    PFCardList {
                        ForEach(files) { file in FileRow(file: file, tenantId: tenantId, showsOrigin: true).padding(.horizontal, PFSpace.m) }
                    }
                }
                if let quota {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(L10n.t("files.quota.label")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                        if let total = quota.quotaBytes, total > 0 {
                            PFProgressBar(value: Double(quota.usedBytes) / Double(total))
                        }
                        Text([quota.usedBytes.formatted(.byteCount(style: .file, allowedUnits: .all, spellsOutZero: false)),
                              quota.quotaBytes.map { $0.formatted(.byteCount(style: .file, spellsOutZero: false)) }].compactMap { $0 }.joined(separator: " / "))
                            .pfText(.meta).foregroundStyle(PFColor.textMuted)
                    }
                    .padding(.top, PFSpace.s)
                }
            }
            .padding(.top, PFSpace.l)
        }
        .task {
            let isGuest = model.session?.role == .guest
            let projectIds = (model.workspace?.projects ?? []).map(\.id)
            let created = FilesStore.workspace(tenantId: tenantId, isGuest: isGuest, projectIds: projectIds)
            store = created
            created.start()
            quota = await FilesData.quota(tenantId: tenantId)
        }
        .onDisappear { store?.stop() }
    }
}
