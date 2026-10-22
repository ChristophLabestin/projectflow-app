import SwiftUI
import FirebaseFirestore
import PFData
import PFDesign
import PFModel

/// Project templates offered on the phone (`web/config/projectTemplates.ts`). The company/startup and
/// marketing templates need the web wizard (tracks, seeded tasks, social/marketing modules).
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
        ProjectTemplate(id: "internal_operations", labelKey: "projectTemplates.internalOperations.label", descriptionKey: "projectTemplates.internalOperations.description",
                        symbol: "slider.horizontal.3", category: "operations", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity"], mode: "maintain", cadence: "biweekly"),
        ProjectTemplate(id: "finance_setup", labelKey: "projectTemplates.financeSetup.label", descriptionKey: "projectTemplates.financeSetup.description",
                        symbol: "building.columns", category: "finance", legacyType: "standard",
                        modules: ["tasks", "initiatives", "milestones", "activity", "accounting"], mode: "build", cadence: "monthly"),
    ]
}

/// Creates a project doc with the base fields of web `createProject` (projectAdminService) plus the
/// template fields the web wizard writes. Returns the new project id.
@MainActor
enum ProjectCreation {
    static func create(tenantId: String, uid: String, title: String, template: ProjectTemplate) async throws -> String {
        let doc = PFPath.projects(tenantId).document()
        let data: [String: Any] = [
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
            "description": "",
            "projectType": template.legacyType,
            "projectCategory": template.category,
            "templateId": template.id,
            "operatingMode": template.mode,
            "operatingModel": ["mode": template.mode, "cadence": template.cadence],
            "brief": ["cadence": template.cadence],
            "priority": "Medium",
            "status": "Active",
            "isPrivate": false,
            "modules": template.modules,
            "tenantId": tenantId,
            "ownerId": uid,
            "screenshots": [String](),
            "progress": 0,
            "members": [uid],
            "memberIds": [uid],
            "visibilityGroupIds": [String](),
            "visibilityGroupId": NSNull(),
            "createdAt": FieldValue.serverTimestamp(),
        ]
        try await doc.setData(data)
        return doc.documentID
    }
}

/// "Neues Projekt": a name and a template, nothing else (everything else is editable on the web).
struct ProjectCreateSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var title = ""
    @State private var templateId = ProjectTemplate.all[0].id
    @State private var isCreating = false

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(L10n.t("projects.new.eyebrow"), title: L10n.t("projects.new.title"))
            PFTextField(L10n.t("projects.new.namePlaceholder"), text: $title, onSubmit: create)
                .padding(.horizontal, PFSpace.page)
            VStack(spacing: 0) {
                ForEach(Array(ProjectTemplate.all.enumerated()), id: \.element.id) { index, template in
                    if index > 0 { PFRowDivider(leadingInset: 64) }
                    templateRow(template)
                }
            }
            .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .padding(.horizontal, PFSpace.m)
            PFButton(L10n.t("projects.new.create"), systemImage: "plus", fullWidth: true, action: create)
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isCreating)
                .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }

    private func templateRow(_ template: ProjectTemplate) -> some View {
        let selected = template.id == templateId
        return Button {
            PFHaptics.selection()
            withAnimation(PFMotion.fast) { templateId = template.id }
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

    private func create() {
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !isCreating, let uid = model.uid, let tenantId = model.workspace?.tenantId,
              let template = ProjectTemplate.all.first(where: { $0.id == templateId }) else { return }
        isCreating = true
        Task {
            do {
                let id = try await ProjectCreation.create(tenantId: tenantId, uid: uid, title: name, template: template)
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
