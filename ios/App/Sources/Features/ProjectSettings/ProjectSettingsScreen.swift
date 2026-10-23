import SwiftUI
import PFData
import PFDesign
import PFModel

/// Project settings (gear in the cockpit): the web `ProjectEditModal` tabs as grouped sections. Workspace roles live
/// in the Team feature, GitHub is connected on the web.
struct ProjectSettingsScreen: View {
    let tenantId: String
    let projectId: String

    var body: some View {
        ProjectSettingsContent(tenantId: tenantId, projectId: projectId)
    }
}

/// Resolves the signed-in uid before creating the store (the store needs it for the per-user navigation prefs).
private struct ProjectSettingsContent: View {
    let tenantId: String
    let projectId: String
    @Environment(AppModel.self) private var model

    var body: some View {
        if let uid = model.uid {
            ProjectSettingsBody(store: ProjectSettingsStore(tenantId: tenantId, projectId: projectId, uid: uid))
                .id(uid)
        } else {
            Color.clear
        }
    }
}

private struct ProjectSettingsBody: View {
    @State var store: ProjectSettingsStore
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var topInset: CGFloat = 0

    private var projectId: String { store.projectId }
    private var data: ProjectSettingsData? { store.data }
    private var workspaceProject: Project? { model.workspace?.project(projectId) }

    /// Owner, admin, project Owner/Editor may edit; viewers and other roles read.
    private var canEdit: Bool {
        let access = ProjectAccess(model: model, project: workspaceProject)
        if access.isAdmin || access.isOwner { return true }
        return access.projectRole == "Owner" || access.projectRole == "Editor"
    }

    private var canDelete: Bool {
        let access = ProjectAccess(model: model, project: workspaceProject)
        return access.isAdmin || access.isOwner || access.projectRole == "Owner"
    }

    var body: some View {
        ZStack(alignment: .top) {
            PFCanvas(dotted: true)
            if let data {
                ScrollView {
                    VStack(alignment: .leading, spacing: PFSpace.xl) {
                        Color.clear.frame(height: topInset + 48)
                        header(data)
                        if !canEdit { readOnlyBanner }
                        general(data)
                        briefing(data)
                        appearance(data)
                        team(data)
                        modules(data)
                        navigation
                        resources(data)
                        labels
                        integrations(data)
                        if canEdit { lifecycle(data) }
                        if canDelete { danger }
                    }
                    .padding(.horizontal, PFSpace.page)
                    .padding(.bottom, PFSpace.xxl * 2)
                }
                .scrollIndicators(.hidden)
                .ignoresSafeArea(.container, edges: [.top, .bottom])
            } else {
                VStack(spacing: PFSpace.m) {
                    PFSkeleton(height: 34, radius: 8).frame(width: 220)
                    PFSkeleton(height: 220, radius: PFRadius.card)
                }
                .padding(PFSpace.page)
                .padding(.top, 90)
                .frame(maxHeight: .infinity, alignment: .top)
            }
            PFTopBar(backLabel: L10n.t("common.back"), onBack: { model.router.pop() })
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topInset = $0 }
        .task { store.start() }
        .onDisappear { store.stop() }
    }

    // MARK: Header

    private func header(_ data: ProjectSettingsData) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            PFEyebrow(data.title)
            Text(L10n.t("projectSettings.title")).pfText(.display).foregroundStyle(PFColor.textMain)
        }
        .padding(.top, PFSpace.s)
    }

    private var readOnlyBanner: some View {
        HStack(spacing: PFSpace.xs) {
            Image(systemName: "lock").font(.system(size: 13, weight: .semibold))
            Text(L10n.t("projectSettings.readOnly")).pfText(.meta)
        }
        .foregroundStyle(PFColor.textMuted)
        .padding(PFSpace.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
    }

    // MARK: Sections

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(title).padding(.horizontal, 2)
            PFCardList(content: content)
        }
    }

    private func row(_ label: String, value: String, edit: (() -> Void)?) -> some View {
        PFDetailRow(label, showsChevron: canEdit && edit != nil, action: canEdit ? edit : nil) {
            Text(value).lineLimit(1).foregroundStyle(value.isEmpty || value == "—" ? PFColor.textSubtle : PFColor.textMain)
        }
    }

    private func general(_ data: ProjectSettingsData) -> some View {
        let template = ProjectTemplate.all.first { $0.id == (data.templateId ?? "") } ?? ProjectTemplate.all.first { $0.category == data.projectCategory }
        let software = ProjectSettingsCatalog.isSoftware(category: data.projectCategory, templateId: data.templateId, type: data.projectType)
        return section(L10n.t("projectSettings.section.general")) {
            row(L10n.t("projectSettings.general.name"), value: data.title) {
                present(SettingsTextSheet(eyebrow: L10n.t("projectSettings.section.general"), title: L10n.t("projectSettings.general.name"), placeholder: L10n.t("projectSettings.general.name"),
                                          initial: data.title) { value in write("title", value) })
            }
            row(L10n.t("projectSettings.general.description"), value: data.description.isEmpty ? "—" : data.description) {
                present(SettingsTextSheet(eyebrow: L10n.t("projectSettings.section.general"), title: L10n.t("projectSettings.general.description"),
                                          placeholder: L10n.t("projectSettings.general.description"), initial: data.description, multiline: true, allowsEmpty: true) { value in write("description", value) })
            }
            row(L10n.t("common.status"), value: data.status.label) {
                let options = ProjectSettingsCatalog.statusOptions(current: data.status, isSoftware: software)
                presentOptions(L10n.t("common.status"), options.map { ($0.rawValue, $0.label, $0 == data.status) }) { id in write("status", id) }
            }
            row(L10n.t("common.priority"), value: data.priority?.label ?? L10n.t("priority.none")) {
                presentOptions(L10n.t("common.priority"), ProjectSettingsCatalog.priorities.map { ($0.rawValue, $0.label, $0 == data.priority) }) { id in write("priority", id) }
            }
            row(L10n.t("projectSettings.general.type"), value: template.map { L10n.t($0.labelKey) } ?? data.projectCategory) {
                presentOptions(L10n.t("projectSettings.general.type"), ProjectTemplate.all.map { ($0.id, L10n.t($0.labelKey), $0.id == template?.id) }) { id in
                    guard let picked = ProjectTemplate.all.first(where: { $0.id == id }), let actions = model.projectActions else { return }
                    Task {
                        _ = await model.perform {
                            try await actions.update(projectId, ["templateId": picked.id, "projectCategory": picked.category, "projectType": picked.legacyType])
                        }
                    }
                }
            }
            if software {
                row(L10n.t("projectSettings.general.state"), value: L10n.t("projectSettings.state.\(data.projectState)")) {
                    presentOptions(L10n.t("projectSettings.general.state"), ProjectSettingsCatalog.projectStates.map { ($0, L10n.t("projectSettings.state.\($0)"), $0 == data.projectState) }) { id in write("projectState", id) }
                }
            }
            row(L10n.t("projectSettings.general.start"), value: data.startDate.map { Formatting.shortDate($0) } ?? L10n.t("common.noDate")) {
                presentDate(L10n.t("projectSettings.general.start"), initial: data.startDate) { write("startDate", $0?.webString ?? "") }
            }
            row(L10n.t("projectSettings.general.due"), value: data.dueDate.map { Formatting.shortDate($0) } ?? L10n.t("common.noDate")) {
                presentDate(L10n.t("projectSettings.general.due"), initial: data.dueDate) { write("dueDate", $0?.webString ?? "") }
            }
            switchRow(L10n.t("projectSettings.general.private"), isOn: data.isPrivate) { write("isPrivate", $0) }
        }
    }

    private func briefing(_ data: ProjectSettingsData) -> some View {
        section(L10n.t("projectSettings.section.briefing")) {
            row(L10n.t("projectSettings.briefing.title"), value: data.objective.isEmpty && data.scope.isEmpty ? "—" : L10n.t(data.successCriteria.isEmpty ? "projectSettings.briefing.set" : "projectSettings.briefing.criteriaCount", ["count": data.successCriteria.count])) {
                let initial = BriefingValues(objective: data.objective.isEmpty ? data.description : data.objective, criteria: data.successCriteria.joined(separator: "\n"),
                                             scope: data.scope, decisionOwner: data.decisionOwner, cadence: data.cadence, mode: data.operatingMode, confidence: data.dateConfidence)
                present(BriefingSheet(initial: initial) { values in
                    guard let actions = model.projectActions else { return }
                    Task {
                        _ = await model.perform {
                            try await actions.saveBriefing(projectId, current: data, objective: values.objective,
                                                           successCriteria: values.criteria.split(whereSeparator: { $0 == "\n" || $0 == ";" }).map(String.init),
                                                           scope: values.scope, decisionOwner: values.decisionOwner, cadence: values.cadence,
                                                           operatingMode: values.mode, dateConfidence: values.confidence, risks: data.risks)
                        }
                    }
                }, large: true)
            }
            row(L10n.t("projectSettings.risks.title"), value: data.risks.isEmpty ? "—" : "\(data.risks.filter { $0.status != "resolved" }.count)/\(data.risks.count)") {
                present(RisksSheet(initial: data.risks) { risks in
                    guard let actions = model.projectActions else { return }
                    Task { _ = await model.perform { try await actions.update(projectId, ["riskRegister": risks.filter { !$0.title.trimmingCharacters(in: .whitespaces).isEmpty }.map(\.map)]) } }
                }, large: true)
            }
        }
    }

    private func appearance(_ data: ProjectSettingsData) -> some View {
        section(L10n.t("projectSettings.section.appearance")) {
            PFDetailRow(L10n.t("projectSettings.appearance.title"), showsChevron: canEdit, action: canEdit ? { present(AppearanceSheet(store: store), large: true) } : nil) {
                HStack(spacing: 6) {
                    if !(data.coverImage ?? "").isEmpty { Image(systemName: "photo").foregroundStyle(PFColor.textMuted) }
                    PFProjectGlyph(title: data.title, imageURL: data.squareIcon, size: 28)
                }
            }
        }
    }

    private func team(_ data: ProjectSettingsData) -> some View {
        section(L10n.t("projectSettings.section.team")) {
            PFDetailRow(L10n.t("projectSettings.team.members"), showsChevron: true, action: { model.router.push(.team) }) {
                Text(data.memberCount > 0 ? "\(data.memberCount)" : "—")
            }
        }
    }

    private func modules(_ data: ProjectSettingsData) -> some View {
        section(L10n.t("projectSettings.section.modules")) {
            ForEach(ProjectSettingsCatalog.modules) { module in
                switchRow(L10n.t(module.labelKey), isOn: data.modules.contains(module.id), locked: module.locked) { on in
                    var next = data.modules
                    if on { if !next.contains(module.id) { next.append(module.id) } } else { next.removeAll { $0 == module.id } }
                    let ordered = ProjectSettingsCatalog.modules.map(\.id).filter { next.contains($0) }
                    guard let actions = model.projectActions else { return }
                    Task { _ = await model.perform { try await actions.setModules(projectId, ordered) } }
                }
            }
        }
    }

    private var navigation: some View {
        section(L10n.t("projectSettings.section.navigation")) {
            PFDetailRow(L10n.t("projectSettings.nav.title"), showsChevron: true, action: {
                present(NavPrefsSheet(modules: Set(data?.modules ?? []), initial: store.navPrefs) { prefs in
                    guard let actions = model.projectActions else { return }
                    Task { _ = await model.perform { try await actions.saveNavPrefs(projectId, prefs) } }
                }, large: true)
            }) { Text(store.navPrefs.hidden.isEmpty ? "" : L10n.plural("projectSettings.nav.hiddenCount", store.navPrefs.hidden.count)) }
        }
    }

    private func resources(_ data: ProjectSettingsData) -> some View {
        section(L10n.t("projectSettings.section.resources")) {
            row(L10n.t("projectSettings.links.title"), value: data.links.count + data.externalResources.count == 0 ? "—" : "\(data.links.count + data.externalResources.count)") {
                present(LinksSheet(initialLinks: data.links, initialResources: data.externalResources) { links, resources in
                    guard let actions = model.projectActions else { return }
                    Task { _ = await model.perform { try await actions.saveLinks(projectId, links: links, resources: resources) } }
                }, large: true)
            }
        }
    }

    private var labels: some View {
        section(L10n.t("projectSettings.section.labels")) {
            PFDetailRow(L10n.t("projectSettings.labels.title"), showsChevron: true, action: { present(LabelsSheet(store: store, canEdit: canEdit), large: true) }) {
                Text(store.labels.isEmpty ? "—" : "\(store.labels.count)")
            }
        }
    }

    private func integrations(_ data: ProjectSettingsData) -> some View {
        section(L10n.t("projectSettings.section.integrations")) {
            PFDetailRow("GitHub") {
                Text(data.githubRepo.isEmpty ? L10n.t("projectSettings.github.notLinked") : data.githubRepo).lineLimit(1)
            }
            if !data.githubRepo.isEmpty {
                PFDetailRow(L10n.t("projectSettings.github.issueSync")) { Text(L10n.t(data.githubIssueSync ? "projectSettings.on" : "projectSettings.off")) }
            }
            PFDetailRow(L10n.t("projectSettings.github.connectWeb"), showsChevron: true, action: { ProjectsClipboard.open(ProjectLinks.projectSettings(projectId)) }) {
                Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textMuted)
            }
        }
    }

    // MARK: Lifecycle

    private func lifecycle(_ data: ProjectSettingsData) -> some View {
        let project = Project(id: projectId, tenantId: store.tenantId, title: data.title, status: data.status)
        return section(L10n.t("projectSettings.section.lifecycle")) {
            if data.status == .onHold {
                actionRow("play.circle", L10n.t("projectSettings.lifecycle.resume")) { run { try await $0.resume(project, pausedFrom: data.pausedFromStatus) } }
            } else if data.status != .canceled {
                actionRow("pause.circle", L10n.t("projectSettings.lifecycle.pause")) { run { try await $0.pause(project) } }
            }
            if data.status != .completed {
                actionRow("checkmark.circle", L10n.t("projectSettings.lifecycle.complete")) {
                    confirm(L10n.t("projectSettings.lifecycle.complete.title"), L10n.t("projectSettings.lifecycle.complete.message", ["project": data.title]),
                            L10n.t("projectSettings.lifecycle.complete.confirm"), destructive: false) { run { try await $0.complete(project) } }
                }
            }
            if data.status != .canceled {
                actionRow("xmark.circle", L10n.t("projectSettings.lifecycle.cancel"), destructive: true) {
                    confirm(L10n.t("projectSettings.lifecycle.cancel.title"), L10n.t("projectSettings.lifecycle.cancel.message", ["project": data.title]),
                            L10n.t("projectSettings.lifecycle.cancel.confirm")) { run { try await $0.cancel(project) } }
                }
            }
            if data.status == .canceled || data.status == .completed {
                actionRow("arrow.uturn.backward.circle", L10n.t("projectSettings.lifecycle.reactivate")) { write("status", ProjectStatus.active.rawValue) }
            }
        }
    }

    private var danger: some View {
        section(L10n.t("projectSettings.section.danger")) {
            actionRow("trash", L10n.t("projectSettings.delete.action"), destructive: true) {
                confirm(L10n.t("projectSettings.delete.title"), L10n.t("projectSettings.delete.message", ["project": data?.title ?? ""]), L10n.t("projectSettings.delete.confirm")) { deleteProject() }
            }
        }
    }

    private func deleteProject() {
        guard let actions = model.projectActions else { return }
        Task {
            if await model.perform({ try await actions.delete(projectId) }) {
                PFHaptics.success()
                model.router.current.popToRoot()
                model.toasts.show(PFToast(L10n.t("projectSettings.delete.done")))
            }
        }
    }

    // MARK: Helpers

    private func run(_ work: @escaping (ProjectActions) async throws -> Void) {
        guard let actions = model.projectActions else { return }
        Task { if await model.perform({ try await work(actions) }) { PFHaptics.success() } }
    }

    private func write(_ key: String, _ value: Any?) {
        guard let actions = model.projectActions else { return }
        Task { _ = await model.perform { try await actions.setField(projectId, key, value) } }
    }

    private func present<Content: View>(_ content: Content, large: Bool = false) {
        presenter.present(detents: large ? [.large] : [.fit]) { content }
    }

    private func presentOptions(_ title: String, _ options: [(id: String, label: String, selected: Bool)], onSelect: @escaping (String) -> Void) {
        presenter.present(detents: [.fit]) {
            OptionSheet(title: title, options: options.map { option in
                OptionSheet.Option(id: option.id, label: option.label, isSelected: option.selected) { EmptyView() }
            }, onSelect: onSelect)
        }
    }

    private func presentDate(_ title: String, initial: FlexDate?, onSave: @escaping (FlexDate?) -> Void) {
        presenter.present(detents: [.fit]) {
            DateSheet(eyebrow: L10n.t("projectSettings.section.general"), title: title, initial: initial, onSave: onSave)
        }
    }

    private func confirm(_ title: String, _ message: String, _ confirmTitle: String, destructive: Bool = true, onConfirm: @escaping () -> Void) {
        presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: title, message: message, confirmTitle: confirmTitle, onConfirm: onConfirm)
        }
    }

    private func switchRow(_ label: String, isOn: Bool, locked: Bool = false, onChange: @escaping (Bool) -> Void) -> some View {
        PFSwitch(label, isOn: Binding(get: { isOn }, set: { onChange($0) }))
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 54)
            .disabled(!canEdit || locked)
            .opacity(canEdit && !locked ? 1 : 0.55)
    }

    private func actionRow(_ symbol: String, _ title: String, destructive: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: PFSpace.s) {
                Image(systemName: symbol).font(.system(size: 16, weight: .medium)).frame(width: 24)
                Text(title).pfText(.rowTitle)
                Spacer(minLength: 0)
            }
            .foregroundStyle(destructive ? PFColor.dangerText : PFColor.textMain)
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 54)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }
}
