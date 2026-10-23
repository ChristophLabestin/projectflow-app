import SwiftUI
import PFData
import PFDesign
import PFModel

// Edit sheets of the project settings. Every sheet keeps local state and hands the result to `onSave`.

// MARK: - Building blocks

/// Header, scrolling content and a save button: the frame of every settings sheet.
struct SettingsSheetFrame<Content: View>: View {
    let eyebrow: String
    let title: String?
    var saveTitle = L10n.t("common.save")
    var canSave = true
    let onSave: () -> Void
    @ViewBuilder let content: Content
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(eyebrow, title: title)
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.m) { content }
                    .padding(.horizontal, PFSpace.page)
                    .padding(.bottom, PFSpace.m)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            PFButton(saveTitle, fullWidth: true) {
                onSave()
                presenter.dismiss()
            }
            .disabled(!canSave)
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }
}

/// Small caption above a field.
struct SettingsField<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PFEyebrow(label)
            content
        }
    }
}

/// Single-choice chips (cadence, operating mode, severity …).
struct SettingsChoice: View {
    let options: [(id: String, label: String)]
    @Binding var selection: String

    var body: some View {
        PFChipRow {
            ForEach(options, id: \.id) { option in
                PFChip(option.label, isSet: option.id == selection) {
                    PFHaptics.selection()
                    selection = option.id
                }
            }
        }
        .padding(.horizontal, -PFSpace.page)
    }
}

// MARK: - Text

struct SettingsTextSheet: View {
    let eyebrow: String
    let title: String
    let placeholder: String
    let initial: String
    var multiline = false
    var allowsEmpty = false
    let onSave: (String) -> Void
    @State private var text = ""

    var body: some View {
        SettingsSheetFrame(eyebrow: eyebrow, title: title, canSave: allowsEmpty || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                           onSave: { onSave(text.trimmingCharacters(in: .whitespacesAndNewlines)) }) {
            PFTextField(placeholder, text: $text, axis: multiline ? .vertical : .horizontal)
        }
        .onAppear { text = initial }
    }
}

// MARK: - Briefing

struct BriefingValues {
    var objective: String
    var criteria: String
    var scope: String
    var decisionOwner: String
    var cadence: String
    var mode: String
    var confidence: String
}

struct BriefingSheet: View {
    let initial: BriefingValues
    let onSave: (BriefingValues) -> Void
    @State private var values = BriefingValues(objective: "", criteria: "", scope: "", decisionOwner: "", cadence: "weekly", mode: "build", confidence: "target")

    var body: some View {
        SettingsSheetFrame(eyebrow: L10n.t("projectSettings.section.briefing"), title: L10n.t("projectSettings.briefing.title"), onSave: { onSave(values) }) {
            SettingsField(label: L10n.t("projectSettings.briefing.objective")) {
                PFTextField(L10n.t("projectSettings.briefing.objective.placeholder"), text: $values.objective, axis: .vertical)
            }
            SettingsField(label: L10n.t("projectSettings.briefing.criteria")) {
                PFTextField(L10n.t("projectSettings.briefing.criteria.placeholder"), text: $values.criteria, axis: .vertical)
            }
            SettingsField(label: L10n.t("projectSettings.briefing.scope")) {
                PFTextField(L10n.t("projectSettings.briefing.scope.placeholder"), text: $values.scope, axis: .vertical)
            }
            SettingsField(label: L10n.t("projectSettings.briefing.owner")) {
                PFTextField(L10n.t("projectSettings.briefing.owner.placeholder"), text: $values.decisionOwner)
            }
            SettingsField(label: L10n.t("projectSettings.briefing.cadence")) {
                SettingsChoice(options: ProjectSettingsCatalog.cadences.map { ($0, L10n.t("projectSettings.cadence.\($0)")) }, selection: $values.cadence)
            }
            SettingsField(label: L10n.t("projectSettings.briefing.mode")) {
                SettingsChoice(options: ProjectSettingsCatalog.modes.map { ($0, L10n.t("projectSettings.mode.\($0)")) }, selection: $values.mode)
            }
            SettingsField(label: L10n.t("projectSettings.briefing.confidence")) {
                SettingsChoice(options: ProjectSettingsCatalog.confidences.map { ($0, L10n.t("projectSettings.confidence.\($0)")) }, selection: $values.confidence)
            }
        }
        .onAppear { values = initial }
    }
}

// MARK: - Risks

struct RisksSheet: View {
    let initial: [ProjectRisk]
    let onSave: ([ProjectRisk]) -> Void
    @State private var risks: [ProjectRisk] = []

    var body: some View {
        SettingsSheetFrame(eyebrow: L10n.t("projectSettings.section.briefing"), title: L10n.t("projectSettings.risks.title"), onSave: { onSave(risks) }) {
            if risks.isEmpty {
                Text(L10n.t("projectSettings.risks.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            ForEach($risks) { $risk in
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    HStack(spacing: PFSpace.xs) {
                        PFTextField(L10n.t("projectSettings.risks.titlePlaceholder"), text: $risk.title)
                        PFIconButton("trash", label: L10n.t("common.remove"), style: .glass, size: 44) {
                            withAnimation(PFMotion.respecting(PFMotion.snappy)) { risks.removeAll { $0.id == risk.id } }
                        }
                    }
                    PFTextField(L10n.t("projectSettings.risks.mitigationPlaceholder"), text: $risk.mitigation, axis: .vertical)
                    SettingsChoice(options: ProjectSettingsCatalog.severities.map { ($0, L10n.t("projectSettings.severity.\($0)")) }, selection: $risk.severity)
                    PFSwitch(L10n.t("projectSettings.risks.resolved"), isOn: Binding(get: { risk.status == "resolved" }, set: { risk.status = $0 ? "resolved" : "open" }))
                }
                .padding(PFSpace.s)
                .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            }
            PFButton(L10n.t("projectSettings.risks.add"), systemImage: "plus", kind: .secondary, fullWidth: true) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { risks.append(ProjectRisk(title: "")) }
            }
        }
        .onAppear { risks = initial }
    }
}

// MARK: - Links and resources

struct LinksSheet: View {
    let initialLinks: [ProjectLinkItem]
    let initialResources: [ProjectLinkItem]
    let onSave: ([ProjectLinkItem], [ProjectLinkItem]) -> Void
    @State private var links: [ProjectLinkItem] = []
    @State private var resources: [ProjectLinkItem] = []

    var body: some View {
        SettingsSheetFrame(eyebrow: L10n.t("projectSettings.section.resources"), title: L10n.t("projectSettings.links.title"), onSave: { onSave(links, resources) }) {
            group(title: L10n.t("projectSettings.links.overview"), hint: L10n.t("projectSettings.links.overview.hint"), items: $links)
            group(title: L10n.t("projectSettings.links.resources"), hint: L10n.t("projectSettings.links.resources.hint"), items: $resources)
        }
        .onAppear {
            links = initialLinks
            resources = initialResources
        }
    }

    private func group(title: String, hint: String, items: Binding<[ProjectLinkItem]>) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(title)
            Text(hint).pfText(.meta).foregroundStyle(PFColor.textMuted)
            ForEach(items) { $item in
                VStack(spacing: PFSpace.xs) {
                    HStack(spacing: PFSpace.xs) {
                        PFTextField(L10n.t("projectSettings.links.titlePlaceholder"), text: $item.title)
                        PFIconButton("trash", label: L10n.t("common.remove"), style: .glass, size: 44) {
                            withAnimation(PFMotion.respecting(PFMotion.snappy)) { items.wrappedValue.removeAll { $0.id == item.id } }
                        }
                    }
                    PFTextField(L10n.t("projectSettings.links.urlPlaceholder"), text: $item.url, systemImage: "link")
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                }
            }
            PFButton(L10n.t("projectSettings.links.add"), systemImage: "plus", kind: .secondary, fullWidth: true) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { items.wrappedValue.append(ProjectLinkItem(title: "", url: "")) }
            }
        }
    }
}

// MARK: - Navigation preferences

struct NavPrefsSheet: View {
    let modules: Set<String>
    let initial: ProjectNavPrefs
    let onSave: (ProjectNavPrefs) -> Void
    @State private var order: [String] = []
    @State private var hidden: Set<String> = []

    private var items: [(id: String, labelKey: String, canHide: Bool, symbol: String)] {
        let all = ProjectSettingsCatalog.navItems.filter { $0.id == "overview" || modules.contains($0.id) }
        return order.compactMap { id in all.first { $0.id == id } }
    }

    var body: some View {
        SettingsSheetFrame(eyebrow: L10n.t("projectSettings.section.navigation"), title: L10n.t("projectSettings.nav.title"),
                           onSave: { onSave(ProjectNavPrefs(order: order, hidden: Array(hidden))) }) {
            Text(L10n.t("projectSettings.nav.note")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { PFRowDivider(leadingInset: 52) }
                    HStack(spacing: PFSpace.s) {
                        Image(systemName: item.symbol).font(.system(size: 15, weight: .medium)).foregroundStyle(PFColor.textMuted).frame(width: 24)
                        Text(L10n.t(item.labelKey)).pfText(.rowTitle).foregroundStyle(hidden.contains(item.id) ? PFColor.textSubtle : PFColor.textMain)
                        Spacer(minLength: 0)
                        iconButton("arrow.up", L10n.t("projectSettings.nav.up"), enabled: index > 0) { move(index, by: -1) }
                        iconButton("arrow.down", L10n.t("projectSettings.nav.down"), enabled: index < items.count - 1) { move(index, by: 1) }
                        iconButton(hidden.contains(item.id) ? "eye.slash" : "eye", L10n.t(hidden.contains(item.id) ? "projectSettings.nav.show" : "projectSettings.nav.hide"),
                                   enabled: item.canHide) {
                            if hidden.contains(item.id) { hidden.remove(item.id) } else { hidden.insert(item.id) }
                        }
                    }
                    .padding(.horizontal, PFSpace.m)
                    .frame(minHeight: 52)
                }
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        }
        .onAppear {
            let known = ProjectSettingsCatalog.navItems.map(\.id)
            var result = initial.order.filter { known.contains($0) }
            for id in known where !result.contains(id) { result.append(id) }
            order = result
            hidden = Set(initial.hidden)
        }
    }

    private func move(_ index: Int, by offset: Int) {
        let visible = items.map(\.id)
        guard visible.indices.contains(index + offset),
              let from = order.firstIndex(of: visible[index]), let to = order.firstIndex(of: visible[index + offset]) else { return }
        PFHaptics.selection()
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { order.swapAt(from, to) }
    }

    private func iconButton(_ symbol: String, _ label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 14, weight: .semibold))
                .foregroundStyle(enabled ? PFColor.textMain : PFColor.textSubtle.opacity(0.4))
                .frame(width: 36, height: 36)
                .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }
}

// MARK: - Appearance (icon + cover)

struct AppearanceSheet: View {
    let store: ProjectSettingsStore
    @Environment(AppModel.self) private var model
    @State private var isUploading = false

    var body: some View {
        let data = store.data
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(L10n.t("projectSettings.section.appearance"), title: L10n.t("projectSettings.appearance.title"))
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.l) {
                    SettingsField(label: L10n.t("projectSettings.appearance.icon")) {
                        HStack(spacing: PFSpace.m) {
                            PFProjectGlyph(title: data?.title ?? "P", imageURL: data?.squareIcon, size: 72)
                            actions(cover: false, hasImage: !(data?.squareIcon ?? "").isEmpty)
                        }
                    }
                    SettingsField(label: L10n.t("projectSettings.appearance.cover")) {
                        coverPreview(data?.coverImage)
                        actions(cover: true, hasImage: !(data?.coverImage ?? "").isEmpty)
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, PFSpace.m)
            }
            .scrollIndicators(.hidden)
        }
        .padding(.bottom, PFSpace.l)
        .disabled(isUploading)
        .overlay { if isUploading { ProgressView() } }
    }

    @ViewBuilder
    private func coverPreview(_ url: String?) -> some View {
        RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous)
            .fill(PFColor.raised)
            .frame(height: 140)
            .overlay {
                if let url, let parsed = URL(string: url), !url.isEmpty {
                    AsyncImage(url: parsed) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() } else { PFColor.raised }
                    }
                } else {
                    Image(systemName: "photo").font(.system(size: 26)).foregroundStyle(PFColor.textSubtle)
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .accessibilityHidden(true)
    }

    private func actions(cover: Bool, hasImage: Bool) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFButton(L10n.t(hasImage ? "projectSettings.appearance.change" : "projectSettings.appearance.upload"), systemImage: "photo", kind: .secondary, size: .small) {
                upload(cover: cover)
            }
            if hasImage {
                PFButton(L10n.t("common.remove"), kind: .ghost, size: .small) { remove(cover: cover) }
            }
        }
    }

    private func upload(cover: Bool) {
        guard let actions = model.projectActions else { return }
        let projectId = store.projectId
        Task {
            isUploading = true
            defer { isUploading = false }
            guard let file = await MediaUpload.pickAndUpload(model: model, purpose: cover ? .projectCover : .projectIcon, entityId: projectId, projectId: projectId) else { return }
            if await model.perform({ try await actions.setImage(projectId, cover: cover, url: file.url, fileId: file.fileId) }) { PFHaptics.success() }
        }
    }

    private func remove(cover: Bool) {
        guard let actions = model.projectActions else { return }
        let projectId = store.projectId
        Task { _ = await model.perform { try await actions.setImage(projectId, cover: cover, url: nil, fileId: nil) } }
    }
}

// MARK: - Labels

struct LabelsSheet: View {
    let store: ProjectSettingsStore
    let canEdit: Bool
    @Environment(AppModel.self) private var model
    @State private var newName = ""
    @State private var newColor = ProjectSettingsCatalog.labelColors[3]
    @State private var editing: String?
    @State private var editName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(L10n.t("projectSettings.section.labels"), title: L10n.t("projectSettings.labels.title"))
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.m) {
                    if store.labels.isEmpty {
                        Text(L10n.t("projectSettings.labels.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(store.labels.enumerated()), id: \.element.id) { index, label in
                                if index > 0 { PFRowDivider(leadingInset: 40) }
                                row(label)
                            }
                        }
                        .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    }
                    if canEdit {
                        PFEyebrow(L10n.t("projectSettings.labels.new"))
                        PFTextField(L10n.t("projectSettings.labels.namePlaceholder"), text: $newName, onSubmit: add)
                        colorRow(selection: $newColor)
                        PFButton(L10n.t("projectSettings.labels.add"), systemImage: "plus", fullWidth: true, action: add)
                            .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, PFSpace.m)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
        }
        .padding(.bottom, PFSpace.l)
    }

    @ViewBuilder
    private func row(_ label: ProjectLabel) -> some View {
        let isEditing = editing == label.id
        HStack(spacing: PFSpace.s) {
            PFDot(PFColor.hex(label.color) ?? PFColor.textSubtle, size: 12)
            if isEditing {
                PFTextField(L10n.t("projectSettings.labels.namePlaceholder"), text: $editName, onSubmit: { saveEdit(label) })
                PFIconButton("checkmark", label: L10n.t("common.save"), style: .glass, size: 40) { saveEdit(label) }
            } else {
                Text(label.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                Spacer(minLength: 0)
                if canEdit {
                    PFIconButton("pencil", label: L10n.t("common.edit"), style: .glass, size: 36) {
                        editName = label.name
                        editing = label.id
                    }
                    PFIconButton("trash", label: L10n.t("common.delete"), style: .glass, size: 36) { delete(label) }
                }
            }
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 54)
    }

    private func colorRow(selection: Binding<String>) -> some View {
        HStack(spacing: PFSpace.s) {
            ForEach(ProjectSettingsCatalog.labelColors, id: \.self) { hex in
                Button {
                    PFHaptics.selection()
                    selection.wrappedValue = hex
                } label: {
                    Circle().fill(PFColor.hex(hex) ?? PFColor.textSubtle).frame(width: 28, height: 28)
                        .overlay { if selection.wrappedValue == hex { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(.white) } }
                        .frame(width: 34, height: 34)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(hex)
            }
        }
    }

    private func add() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let actions = model.projectActions else { return }
        let color = newColor, projectId = store.projectId
        newName = ""
        Task {
            do {
                try await actions.addLabel(projectId, name: name, color: color)
                PFHaptics.success()
            } catch ProjectActionError.labelExists {
                model.toasts.show(PFToast(L10n.t("projectSettings.labels.exists"), style: .warning))
            } catch {
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
            }
        }
    }

    private func saveEdit(_ label: ProjectLabel) {
        guard let actions = model.projectActions else { return }
        let name = editName, projectId = store.projectId
        editing = nil
        Task { _ = await model.perform { try await actions.updateLabel(projectId, id: label.id, name: name, color: label.color ?? ProjectSettingsCatalog.labelColors[3]) } }
    }

    private func delete(_ label: ProjectLabel) {
        guard let actions = model.projectActions else { return }
        let projectId = store.projectId
        Task { _ = await model.perform { try await actions.deleteLabel(projectId, id: label.id) } }
    }
}
