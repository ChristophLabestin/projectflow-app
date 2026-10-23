import SwiftUI
import FirebaseFirestore
import PFData
import PFDesign
import PFModel

extension AppModel {
    /// Project writes (settings, lifecycle, labels) for the active workspace.
    var projectActions: ProjectActions? {
        guard let tenantId = workspace?.tenantId, let uid else { return nil }
        return ProjectActions(tenantId: tenantId, uid: uid, actorName: profile?.displayName ?? "")
    }
}

/// Project templates (`web/config/projectTemplates.ts`). Starting a company project from the phone creates the
/// project with its template fields; the guided workstream seeding of the web wizard is not part of it.
struct ProjectTemplate: Identifiable, Hashable {
    let id: String
    let labelKey: String
    let descriptionKey: String
    let symbol: String
    let category: String
    let legacyType: String
    let modules: [String]
    let mode: String
    let cadence: String
    var isCompany = false

    static let all: [ProjectTemplate] = [
        ProjectTemplate(id: "blank", labelKey: "projectTemplates.blank.label", descriptionKey: "projectTemplates.blank.description",
                        symbol: "folder", category: "general", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity"], mode: "build", cadence: "weekly"),
        ProjectTemplate(id: "software_release", labelKey: "projectTemplates.softwareRelease.label", descriptionKey: "projectTemplates.softwareRelease.description",
                        symbol: "terminal", category: "software", legacyType: "software",
                        modules: ["tasks", "initiatives", "milestones", "activity"], mode: "build", cadence: "weekly"),
        ProjectTemplate(id: "creative_project", labelKey: "projectTemplates.creativeProject.label", descriptionKey: "projectTemplates.creativeProject.description",
                        symbol: "paintpalette", category: "creative", legacyType: "creative",
                        modules: ["initiatives", "tasks", "milestones", "activity"], mode: "explore", cadence: "weekly"),
        ProjectTemplate(id: "client_delivery", labelKey: "projectTemplates.clientDelivery.label", descriptionKey: "projectTemplates.clientDelivery.description",
                        symbol: "person.2", category: "client_delivery", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity"], mode: "ship", cadence: "weekly"),
        ProjectTemplate(id: "startup_company_formation", labelKey: "projectTemplates.startupCompany.label", descriptionKey: "projectTemplates.startupCompany.description",
                        symbol: "building.2", category: "startup_company", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity", "accounting", "marketing"], mode: "explore", cadence: "weekly", isCompany: true),
        ProjectTemplate(id: "marketing_campaign", labelKey: "projectTemplates.marketingCampaign.label", descriptionKey: "projectTemplates.marketingCampaign.description",
                        symbol: "megaphone", category: "marketing", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity", "marketing"], mode: "ship", cadence: "weekly"),
        ProjectTemplate(id: "internal_operations", labelKey: "projectTemplates.internalOperations.label", descriptionKey: "projectTemplates.internalOperations.description",
                        symbol: "slider.horizontal.3", category: "operations", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity"], mode: "maintain", cadence: "biweekly"),
        ProjectTemplate(id: "finance_setup", labelKey: "projectTemplates.financeSetup.label", descriptionKey: "projectTemplates.financeSetup.description",
                        symbol: "building.columns", category: "finance", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity", "accounting"], mode: "build", cadence: "monthly"),
    ]
}

/// Everything the creation sheet collects.
struct NewProjectInput {
    var title = ""
    var template = ProjectTemplate.all[0]
    var description = ""
    var startDate: FlexDate?
    var dueDate: FlexDate?
    var modules: Set<String> = Set(ProjectTemplate.all[0].modules)
    var isPrivate = false
}

/// Creates a project doc with the base fields of web `createProject` (projectAdminService) plus the
/// template fields the web wizard writes. Returns the new project id.
@MainActor
enum ProjectCreation {
    static func create(tenantId: String, uid: String, actorName: String, input: NewProjectInput) async throws -> String {
        let doc = PFPath.projects(tenantId).document()
        let template = input.template
        let description = input.description.trimmingCharacters(in: .whitespacesAndNewlines)
        var brief: [String: Any] = ["cadence": template.cadence]
        if !description.isEmpty { brief["objective"] = description }
        let orderedModules = ProjectSettingsCatalog.modules.map(\.id).filter { input.modules.contains($0) }
        var data: [String: Any] = [
            "title": input.title.trimmingCharacters(in: .whitespacesAndNewlines),
            "description": description,
            "projectType": template.legacyType,
            "projectCategory": template.category,
            "templateId": template.id,
            "operatingMode": template.mode,
            "dateConfidence": "target",
            "operatingModel": ["mode": template.mode, "cadence": template.cadence, "dateConfidence": "target"],
            "brief": brief,
            "priority": "Medium",
            "status": "Active",
            "isPrivate": input.isPrivate,
            "modules": orderedModules,
            "tenantId": tenantId,
            "ownerId": uid,
            "screenshots": [String](),
            "progress": 0,
            "members": [uid],
            "memberIds": [uid],
            "visibilityGroupIds": [String](),
            "visibilityGroupId": NSNull(),
            "startDate": input.startDate?.webString ?? "",
            "dueDate": input.dueDate?.webString ?? "",
            "createdAt": FieldValue.serverTimestamp(),
        ]
        if template.isCompany { data["companyProjectRole"] = "company" }
        try await doc.setData(data)
        _ = try? await PFPath.activities(tenantId, doc.documentID).addDocument(data: [
            "projectId": doc.documentID, "tenantId": tenantId, "ownerId": uid, "user": actorName, "userAvatar": "",
            "action": "Created project \"\(input.title)\"", "target": "Project", "details": "", "relatedId": NSNull(),
            "type": "status", "createdAt": FieldValue.serverTimestamp(),
        ])
        return doc.documentID
    }
}

/// "Neues Projekt" in three short steps: name + template → description + dates → modules + privacy.
struct ProjectCreateSheet: View {
    private enum Step: Int, CaseIterable { case basics, plan, setup }

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var input = NewProjectInput()
    @State private var step = Step.basics
    @State private var isCreating = false
    @State private var openDate: DateField?

    private enum DateField { case start, due }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.m) {
                    switch step {
                    case .basics: basics
                    case .plan: plan
                    case .setup: setup
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, PFSpace.m)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            footer
        }
        .padding(.bottom, PFSpace.l)
        .animation(PFMotion.respecting(PFMotion.snappy), value: step)
    }

    // MARK: Chrome

    private var header: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(L10n.t("projects.new.eyebrow") + " · " + L10n.t("projects.new.step", ["step": step.rawValue + 1, "total": Step.allCases.count]),
                          title: L10n.t("projects.new.step.\(step.rawValue)"))
            HStack(spacing: 4) {
                ForEach(Step.allCases, id: \.rawValue) { item in
                    Capsule().fill(item.rawValue <= step.rawValue ? PFColor.textMain : PFColor.raised).frame(height: 3)
                }
            }
            .padding(.horizontal, PFSpace.page)
            .accessibilityHidden(true)
        }
    }

    private var footer: some View {
        HStack(spacing: PFSpace.s) {
            if step != .basics {
                PFButton(L10n.t("common.back"), kind: .ghost, fullWidth: true) {
                    openDate = nil
                    step = Step(rawValue: step.rawValue - 1) ?? .basics
                }
            }
            if step == .setup {
                PFButton(L10n.t("projects.new.create"), systemImage: "plus", fullWidth: true, action: create)
                    .disabled(isCreating || trimmedTitle.isEmpty)
            } else {
                PFButton(L10n.t("projects.new.next"), fullWidth: true) {
                    openDate = nil
                    step = Step(rawValue: step.rawValue + 1) ?? .setup
                }
                .disabled(trimmedTitle.isEmpty)
            }
        }
        .padding(.horizontal, PFSpace.page)
    }

    private var trimmedTitle: String { input.title.trimmingCharacters(in: .whitespacesAndNewlines) }

    // MARK: Steps

    private var basics: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFTextField(L10n.t("projects.new.namePlaceholder"), text: $input.title, onSubmit: {})
            PFEyebrow(L10n.t("projects.new.template"))
            VStack(spacing: 0) {
                ForEach(Array(ProjectTemplate.all.enumerated()), id: \.element.id) { index, template in
                    if index > 0 { PFRowDivider(leadingInset: 56) }
                    templateRow(template)
                }
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        }
    }

    private var plan: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFEyebrow(L10n.t("projects.new.description"))
            PFTextField(L10n.t("projects.new.descriptionPlaceholder"), text: $input.description, axis: .vertical)
            PFEyebrow(L10n.t("projects.new.dates"))
            VStack(spacing: 0) {
                dateRow(L10n.t("projects.new.start"), field: .start, value: input.startDate)
                PFRowDivider()
                dateRow(L10n.t("projects.new.due"), field: .due, value: input.dueDate)
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        }
    }

    private var setup: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFEyebrow(L10n.t("projects.new.modules"))
            VStack(spacing: 0) {
                ForEach(Array(ProjectSettingsCatalog.modules.enumerated()), id: \.element.id) { index, module in
                    if index > 0 { PFRowDivider() }
                    PFSwitch(L10n.t(module.labelKey), isOn: moduleBinding(module.id))
                        .padding(.horizontal, PFSpace.m).frame(minHeight: 54)
                        .disabled(module.locked)
                        .opacity(module.locked ? 0.55 : 1)
                }
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            PFEyebrow(L10n.t("projects.new.privacy"))
            VStack(alignment: .leading, spacing: 0) {
                PFSwitch(L10n.t("projectSettings.general.private"), isOn: $input.isPrivate)
                    .padding(.horizontal, PFSpace.m).frame(minHeight: 54)
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            Text(L10n.t(input.isPrivate ? "projects.new.privacy.private" : "projects.new.privacy.workspace"))
                .pfText(.meta).foregroundStyle(PFColor.textMuted)
        }
    }

    private func moduleBinding(_ id: String) -> Binding<Bool> {
        Binding(get: { input.modules.contains(id) }, set: { on in
            if on { input.modules.insert(id) } else { input.modules.remove(id) }
        })
    }

    private func templateRow(_ template: ProjectTemplate) -> some View {
        let selected = template.id == input.template.id
        return Button {
            PFHaptics.selection()
            withAnimation(PFMotion.fast) {
                input.template = template
                input.modules = Set(template.modules)
            }
        } label: {
            HStack(spacing: PFSpace.s) {
                Image(systemName: template.symbol)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(selected ? PFColor.onPrimary : PFColor.textMuted)
                    .frame(width: 36, height: 36)
                    .background(selected ? PFColor.primary : PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(L10n.t(template.labelKey)).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Text(L10n.t(template.descriptionKey)).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                Spacer(minLength: 0)
                if selected { Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(PFColor.textMain) }
            }
            .padding(.horizontal, PFSpace.s)
            .frame(minHeight: 58)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private func dateRow(_ label: String, field: DateField, value: FlexDate?) -> some View {
        let isOpen = openDate == field
        let binding = Binding<Date?>(
            get: { value.flatMap { Formatting.date($0) } },
            set: { date in
                let flex = date.map { FlexDate.day(of: $0, in: Formatting.timeZone) }
                if field == .start { input.startDate = flex } else { input.dueDate = flex }
            })
        return VStack(spacing: 0) {
            Button {
                PFHaptics.selection()
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { openDate = isOpen ? nil : field }
            } label: {
                HStack {
                    Text(label).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Spacer()
                    Text(value.map { Formatting.shortDate($0) } ?? L10n.t("common.noDate")).pfText(.body)
                        .foregroundStyle(value == nil ? PFColor.textSubtle : PFColor.textMain)
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down").font(.system(size: 11, weight: .bold)).foregroundStyle(PFColor.textSubtle)
                }
                .padding(.horizontal, PFSpace.m)
                .frame(minHeight: 54)
                .contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            if isOpen {
                PFDateStrip(quick: [PFDateStrip.Quick(id: "none", label: L10n.t("common.noDate"), date: nil)] + Formatting.quickDates.compactMap { quick in
                    Formatting.date(quick.value).map { PFDateStrip.Quick(id: quick.id, label: quick.label, date: $0) }
                }, days: 60, calendar: Formatting.calendar, locale: L10n.locale, selection: binding)
                    .padding(.bottom, PFSpace.s)
            }
        }
    }

    // MARK: Create

    private func create() {
        guard !trimmedTitle.isEmpty, !isCreating, let uid = model.uid, let tenantId = model.workspace?.tenantId else { return }
        if let start = input.startDate, let due = input.dueDate, start > due {
            model.toasts.show(PFToast(L10n.t("projects.new.dateOrder"), style: .warning))
            return
        }
        isCreating = true
        let actor = model.profile?.displayName ?? ""
        Task {
            do {
                let id = try await ProjectCreation.create(tenantId: tenantId, uid: uid, actorName: actor, input: input)
                PFHaptics.success()
                presenter.dismiss()
                model.router.push(.project(tenantId: tenantId, projectId: id))
            } catch {
                isCreating = false
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
            }
        }
    }
}
