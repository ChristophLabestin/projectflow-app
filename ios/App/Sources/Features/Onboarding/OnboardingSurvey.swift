import SwiftUI
import PFDesign

/// Option ids of the onboarding survey. Shared contract with web (`users/{uid}/private/onboarding.survey`): never rename.
enum OnboardingSurvey {
    static let roles = ["founder", "project_manager", "developer", "designer", "marketing", "agency_freelancer", "other"]
    static let useCases = ["client_projects", "product_development", "startup", "marketing", "team_organization", "personal"]
    static let teamSizes = ["solo", "2_5", "6_20", "21_50", "50_plus"]
    static let industries = ["software", "agency", "ecommerce", "consulting", "education", "other"]
    static let sources = ["google", "app_store", "linkedin", "instagram_tiktok", "referral", "article", "event", "other"]
    static let previousTools = ["asana", "trello", "notion", "jira", "clickup", "monday", "spreadsheet", "none", "other"]

    /// First match in priority order wins.
    private static let templatePriority: [(useCase: String, template: String)] = [
        ("startup", "startup_company_formation"), ("client_projects", "client_delivery"),
        ("product_development", "software_release"), ("marketing", "marketing_campaign"),
        ("team_organization", "internal_operations"), ("personal", "blank"),
    ]

    static func suggestedTemplateId(useCases: [String]) -> String? {
        templatePriority.first { useCases.contains($0.useCase) }?.template
    }

    static func templateLabelKey(_ id: String) -> String? {
        ProjectTemplate.all.first { $0.id == id }?.labelKey
    }
}

/// Wrapping chips for single or multiple choice. Selected = primary fill, unselected = raised.
struct ChoiceChips: View {
    struct Option: Identifiable { let id: String; let title: String }

    let options: [Option]
    let selection: Set<String>
    let onToggle: (String) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(options) { option in
                let selected = selection.contains(option.id)
                Button {
                    PFHaptics.selection()
                    onToggle(option.id)
                } label: {
                    Text(option.title)
                        .pfText(.bodyEmphasis)
                        .foregroundStyle(selected ? PFColor.onPrimary : PFColor.textMain)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 44)
                        .pfPillSurface(selected: selected)
                }
                .buttonStyle(.pfPressable)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: selection)
    }
}
